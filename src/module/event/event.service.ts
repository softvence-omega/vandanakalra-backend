import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/module/prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

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
    console.log("hello");
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
