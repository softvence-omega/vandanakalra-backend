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

@Injectable()
export class EventService {
  constructor(private prisma: PrismaService) {}

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
  }

  async createOutsideEvent(dto: CreateOutsideEventDto, userId?: string) {
    // Optional: Validate that user exists if userId is provided
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new Error('User not found');
    }

    return this.prisma.outsideEvent.create({
      data: {
        title: dto.title,
        description: dto.description,
        pointValue: dto.pointValue,
        userId: userId || undefined, // Prisma handles null/undefined correctly
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
    // 1. Fetch the outside event
    const event = await this.prisma.outsideEvent.findUnique({
      where: { id: eventId },
      include: { user: true },
    });

    if (!event) {
      throw new NotFoundException('Outside event not found');
    }

    if (event.approved) {
      throw new BadRequestException('Event is already approved');
    }

    if (!event.userId) {
      throw new BadRequestException('Event is not associated with any user');
    }

    // 2. Check if user was PRESENT on the event date
    const eventDate = event.date as Date; // assume this is a Date object
    const startOfDay = new Date(eventDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(eventDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const attendance = await this.prisma.attendence.findFirst({
      where: {
        userId: event.userId,
        attendence: 'PRESENT', // must match your enum value
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

    // 3. Update: approve event AND add points to user
    return this.prisma.$transaction(async (tx) => {
      // Update event
      const updatedEvent = await tx.outsideEvent.update({
        where: { id: eventId },
        data: { approved: true },
      });

      // Add points to user
      await tx.user.update({
        where: { id: event.userId! },
        data: {
          point: {
            increment: event.pointValue,
          },
        },
      });

      return updatedEvent;
    });
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

  async getUpcomingEvents() {
    const now = new Date();
    console.log('hello');
    const upcomingEvents = await this.prisma.event.findMany({
      where: {
        date: {
          gt: now,
        },
      },
      include: {
        enrolled: true,
      },
      orderBy: {
        date: 'asc', // Optional: sort by nearest upcoming first
      },
    });

    return upcomingEvents;
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
