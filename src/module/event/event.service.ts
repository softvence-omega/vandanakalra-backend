import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/module/prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CreateOutsideEventDto } from './dto/create-outside.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class EventService {
  constructor(
    private prisma: PrismaService,
    private notification: NotificationService,
  ) {}

  async createEvent(createEventDto: CreateEventDto, userId?: string) {
    // Check if user exists

    // Create event
    const event = await this.prisma.event.create({
      data: {
        title: createEventDto.title,
        description: createEventDto.description,
        pointValue: createEventDto.pointValue,
        date: new Date(createEventDto.date),
        time: createEventDto.time,
        maxStudent: createEventDto.maxStudent,
        eventType: createEventDto.eventType || 'INSIDE',
        userId: userId,
      },
    });
    const users = await this.prisma.user.findMany({
      where: {
        isNewEventNotify: true,
        isActive: true,
        isDeleted: false,
        fcmToken: { not: null },
      },
      select: { fcmToken: true },
    });

    const fcmTokens = users.map((u) => u.fcmToken!).filter(Boolean);

    if (fcmTokens.length > 0) {
      await this.notification.sendBulkPushNotification(
        fcmTokens,
        '🎉 New Event Created!',
        `A new event "${event.title}" is now available!`,
        { eventType: 'new_event', eventId: event.id },
      );
    }
  }

  async createOutsideEvent(dto: CreateOutsideEventDto, userId?: string) {
    // Validate user if provided
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }
    }

    // Parse and validate date
    let eventDate: Date | undefined = undefined;
    if (dto.date) {
      const parsed = new Date(dto.date);
      if (isNaN(parsed.getTime())) {
        throw new BadRequestException(
          'Invalid date. Use ISO 8601 format (e.g., "2026-01-10").',
        );
      }
      eventDate = parsed;
    }

    return this.prisma.outsideEvent.create({
      data: {
        title: dto.title,
        description: dto.description,
        date: eventDate,
        pointValue: dto.pointValue,
        userId: userId || undefined,
      },
    });
  }
  async getUnapprovedOutsideEvents() {
    return this.prisma.outsideEvent.findMany({
      where: {
        approved: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async approveOutsideEvent(eventId: string) {
    // 1. Fetch the outside event with user (including fcmToken)
    const event = await this.prisma.outsideEvent.findUnique({
      where: { id: eventId },
      include: {
        user: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            fcmToken: true,
            point: true,
            isEventApproveNotify: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Outside event not found');
    }

    if (event.approved) {
      throw new BadRequestException('Event is already approved');
    }

    if (!event.userId || !event.user) {
      throw new BadRequestException('Event is not associated with any user');
    }

    // 2. Check attendance on event date
    const eventDate = event.date as Date;
    const startOfDay = new Date(eventDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(eventDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const attendance = await this.prisma.attendence.findFirst({
      where: {
        userId: event.userId,
        attendence: 'PRESENT',
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (!attendance) {
      throw new BadRequestException(
        'User was not marked as PRESENT on the event date. Cannot approve.',
      );
    }

    // 3. Perform DB update in transaction
    const updatedEvent = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.outsideEvent.update({
        where: { id: eventId },
        data: { approved: true },
      });

      await tx.user.update({
        where: { id: event.userId! },
        data: {
          point: { increment: event.pointValue },
        },
      });

      return updated;
    });

    // 4. Send push notification (after successful DB update)
    const { fcmToken, firstname, lastname, isEventApproveNotify } = event.user;

    if (fcmToken && isEventApproveNotify) {
      await this.notification.sendPushNotification(
        fcmToken,
        'Points Awarded! 🎉',
        `Your outside event "${event.title}" has been approved. ${event.pointValue} points added!`,
        { status: 'approved', eventId: event.id },
      );
    }

    return updatedEvent;
  }

  async getUserApprovedOutsideEventsWithSummary(userId: string) {
    // 1. Fetch all approved outside events for the user
    const approvedEvents = await this.prisma.outsideEvent.findMany({
      where: {
        userId,
        approved: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 2. Calculate total count and total points
    const totalCount = approvedEvents.length;
    const totalPoints = approvedEvents.reduce(
      (sum, event) => sum + event.pointValue,
      0,
    );

    return {
      events: approvedEvents,
      totalCount,
      totalPoints,
    };
  }

  async deleteUnapprovedOutsideEvent(eventId: string) {
    // Find the event with approval status
    const event = await this.prisma.outsideEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Outside event not found');
    }

    if (event.approved) {
      throw new BadRequestException('Cannot delete an approved event');
    }

    // Delete the unapproved event
    await this.prisma.outsideEvent.delete({
      where: { id: eventId },
    });

    return {
      message: 'Unapproved outside event deleted successfully',
    };
  }

  async updateEvent(eventId: string, updateEventDto: UpdateEventDto) {
    // Check if event exists
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Prepare update data
    const updateData: any = {};

    if (updateEventDto.title !== undefined)
      updateData.title = updateEventDto.title;
    if (updateEventDto.description !== undefined)
      updateData.description = updateEventDto.description;
    if (updateEventDto.pointValue !== undefined)
      updateData.pointValue = updateEventDto.pointValue;
    if (updateEventDto.date !== undefined)
      updateData.date = new Date(updateEventDto.date);
    if (updateEventDto.time !== undefined)
      updateData.time = updateEventDto.time;
    if (updateEventDto.maxStudent !== undefined)
      updateData.maxStudent = updateEventDto.maxStudent;
    if (updateEventDto.eventType !== undefined)
      updateData.eventType = updateEventDto.eventType;

    // Update event
    const updatedEvent = await this.prisma.event.update({
      where: { id: eventId },
      data: updateData,
    });

    return updatedEvent;
  }

  async getEventById(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        enrolled: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  async getAllEvents() {
    const events = await this.prisma.event.findMany({
      include: {
        enrolled: true,
      },
    });

    return events;
  }

  async getUpcomingEvents(userId: string) {
  const now = new Date();
  // Set to start of the day (00:00:00.000) in local time
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const upcomingEvents = await this.prisma.event.findMany({
      where: {
        date: {
          gte: startOfToday,
        },
      },
      select: {
        id: true,
        date: true,
        time:true,
        // Add other event fields you need here (name, location, etc.)
        title: true, // example
        pointValue:true,
        eventType:true,
        maxStudent:true,
        description:true,
        createdAt:true,
        studentEnrolled:true,
        enrolled: {
          where: {
            userId: userId, // assuming your field is `userId` (check casing!)
          },
          select: {
            userId: true,
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Map to add `enrolled: boolean`
    const eventsWithEnrollmentStatus = upcomingEvents.map((event) => ({
      ...event,
      enrolled: event.enrolled.length > 0, // true if user is enrolled, false otherwise
    }));
    return eventsWithEnrollmentStatus;
  }

  async getAttendedEventsWithStats(userId: string) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Fetch attended enrollments with event data
    const attendedEnrollments = await this.prisma.enrolled.findMany({
      where: {
        userId,
        status: 'ATTENDED',
      },
      include: {
        event: true,
      },
    });

    const totalAttended = attendedEnrollments.length;
    const totalPoints = attendedEnrollments.reduce(
      (sum, enrollment) => sum + enrollment.event.pointValue,
      0,
    );

    return {
      attendedEvents: attendedEnrollments,
      totalAttended,
      totalPoints,
    };
  }

  async getJoinEventsWithStats(userId: string) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Fetch attended enrollments with event data
    const joinEnrollments = await this.prisma.enrolled.findMany({
      where: {
        userId,
        status: 'JOIN',
      },
      include: {
        event: true,
      },
    });

    const totalJoin = joinEnrollments.length;

    return {
      attendedEvents: joinEnrollments,
      totalJoin,
    };
  }
  async deleteEvent(eventId: string, userId?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const deletedEvent = await this.prisma.event.delete({
      where: { id: eventId },
    });

    return deletedEvent;
  }
}
