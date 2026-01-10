// enrollment.service.ts
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/module/prisma/prisma.service';
import { Enrolled, Status, userRole } from '@prisma';
import {
  ClaimPointsDto,
  CreateEnrollementDto,
  UpdateEnrollmentStatusDto,
} from './dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class EnrollementService {
  constructor(
    private prisma: PrismaService,
    private notification: NotificationService,
  ) {}

  // Create enrollment (user self-enrolls)
  async createEnrollment(userId: string, eventId: string) {
    return this.prisma.client.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new BadRequestException('Event not found');
      }

      // Optional: check if event is full
      if (event.studentEnrolled >= event.maxStudent) {
        throw new BadRequestException('Event has reached maximum capacity');
      }

      // Check if already enrolled
      const existing = await tx.enrolled.findUnique({
        where: { userId_eventId: { userId, eventId } },
      });

      if (existing) {
        throw new BadRequestException('Already enrolled in this event');
      }

      // Create enrollment
      const enrollment = await tx.enrolled.create({
        data: {
          userId,
          eventId,
          status: Status.JOIN,
        },
        include: { event: true },
      });

      // Increment studentEnrolled
      await tx.event.update({
        where: { id: eventId },
        data: {
          studentEnrolled: { increment: 1 },
        },
      });

      return enrollment;
    });
  }

  async claimPoints(dto: ClaimPointsDto, userId: string) {
    const { enrolledIds } = dto;

    // Fetch admin to check auto-approve setting
    const admin = await this.prisma.client.user.findFirst({
      where: { role: userRole.ADMIN },
      select: { adminAutoApprovePoint: true }, // only fetch needed field
    });

    const isAutoApprove = admin?.adminAutoApprovePoint === true;

    // 1. Fetch enrollments
    const enrollments = await this.prisma.client.enrolled.findMany({
      where: {
        id: { in: enrolledIds },
        userId: userId,
      },
      include: {
        event: { select: { pointValue: true } },
        user: {
          select: {
            fcmToken: true,
            isEventApproveNotify: true,
          },
        },
      },
    });

    // 2. Validate existence
    const foundIds = new Set(enrollments.map((e) => e.id));
    const missingIds = enrolledIds.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      throw new NotFoundException(
        `Enrollment(s) not found: ${missingIds.join(', ')}`,
      );
    }

    // 3. Validate enrollment state
    for (const e of enrollments) {
      if (e.status !== 'JOIN') {
        throw new BadRequestException(
          `Enrollment ${e.id} must have status 'JOIN' to claim points`,
        );
      }
      if (e.claimPoint) {
        throw new BadRequestException(
          `Points already claimed for enrollment ${e.id}`,
        );
      }
    }

    // 4. Branch logic: auto-approve vs manual claim
    if (isAutoApprove) {
      const updatedEnrollments = await this.prisma.client.$transaction(
        async (tx) => {
          const results: Enrolled[] = [];
          for (const e of enrollments) {
            // Update enrollment
            const updated = await tx.enrolled.update({
              where: { id: e.id },
              data: {
                status: 'ATTENDED', // Prisma accepts string if it matches enum
                claimPoint: true,
              },
            });

            // Award points
            await tx.user.update({
              where: { id: userId },
              data: { point: { increment: e.event.pointValue } },
            });

            // Notify
            if (e.user.fcmToken && e.user.isEventApproveNotify) {
              await this.notification.sendPushNotification(
                e.user.fcmToken,
                'Claim Approved!',
                'Your claimed point has been approved.',
                { status: 'approved' },
              );
            }

            results.push(updated);
          }
          return results;
        },
      );

      return {
        updatedEnrollments,
        message: `Points successfully claimed! You’ve earned Points`,
      }; // matches Promise<Enrolled[]>
    } else {
      // 🕒 MANUAL: just flag for admin review (existing logic)
      return await this.prisma.client.$transaction(async (tx) => {
        const updatePromises = enrollments.map((e) =>
          tx.enrolled.update({
            where: { id: e.id },
            data: { claimPoint: true },
          }),
        );
        return await Promise.all(updatePromises);
      });
    }
  }
  async getAllClaimedWithJoinStatus() {
    const records = await this.prisma.client.enrolled.findMany({
      where: {
        claimPoint: true,
        status: 'JOIN', // as per your request
      },
      include: {
        event: true,
        user: true, // include related event
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return records;
  }

  // Admin-only: update enrollment status (e.g., ATTENDED)
  async updateEnrollmentStatus(
    enrollmentId: string,
    status: UpdateEnrollmentStatusDto,
  ) {
    // 1. Fetch enrollment with event and user
    const enrollment = await this.prisma.client.enrolled.findUnique({
      where: { id: enrollmentId },
      include: { event: true, user: true },
    });

    if (!enrollment) {
      throw new BadRequestException('Enrollment not found');
    }

    // 2. If already ATTENDED, skip or return early
    if (enrollment.status === 'ATTENDED') {
      throw new BadRequestException('User is already marked as ATTENDED');
    }

    const eventDate = enrollment.event.date; // DateTime

    // 3. Normalize event date to UTC start/end of day
    const eventDayStart = new Date(
      Date.UTC(
        eventDate.getUTCFullYear(),
        eventDate.getUTCMonth(),
        eventDate.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const eventDayEnd = new Date(
      Date.UTC(
        eventDate.getUTCFullYear(),
        eventDate.getUTCMonth(),
        eventDate.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    // 4. Check if user has PRESENT attendance on event's date
    const validAttendance = await this.prisma.client.attendence.findFirst({
      where: {
        userId: enrollment.userId,
        attendence: 'PRESENT', // matches AttendanceStatus.PRESENT
        createdAt: {
          gte: eventDayStart,
          lte: eventDayEnd,
        },
      },
    });

    if (!validAttendance) {
      throw new BadRequestException(
        'User was not marked PRESENT on the event date. Cannot mark as ATTENDED.',
      );
    }

    // 5. Proceed with transaction: update status + award points
    const updated = await this.prisma.client.$transaction(async (tx) => {
      const updatedEnrollment = await tx.enrolled.update({
        where: { id: enrollmentId },
        data: { status: status.status },
      });

      await tx.user.update({
        where: { id: enrollment.userId },
        data: { point: { increment: enrollment.event.pointValue } },
      });

      return updatedEnrollment;
    });

    if (enrollment.user.fcmToken && enrollment.user.isEventApproveNotify) {
      //Send notification
      await this.notification.sendPushNotification(
        enrollment.user.fcmToken || '', // assuming you store FCM token in User
        'Claim Approved!',
        'Your claimed point has been approved.',
        { status: 'approved' },
      );
    }

    return updated;
  }

  // Get all JOIN enrollments for a specific user
  async getUserEnrollmentsWithJoinStatus(userId: string) {
    return this.prisma.client.enrolled.findMany({
      where: {
        userId,
        status: Status.JOIN,
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            date: true,
            time: true,
            pointValue: true,
            eventType: true,
          },
        },
      },
    });
  }

  // Optional: Manual claim point (if needed later)
  // Not used in current flow, since auto-claimed on ATTENDED
}
