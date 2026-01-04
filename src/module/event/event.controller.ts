import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Put,
  Get,
  Delete,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import { EventService } from './event.service';
import { CreateEventDto, UpdateEventDto } from './dto';
import sendResponse from '../utils/sendResponse';
import type { Request, Response } from 'express';
import { ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorators';
import { Roles } from 'src/common/decorators/roles.decorator';
import { userRole } from '@prisma/client';

@Controller('event')
export class EventController {
  constructor(private eventService: EventService) {}

  // Create event
  @Post('create-event')
  @Roles(userRole.ADMIN)
  @ApiOperation({
    summary: 'Create a new event',
    description: 'Creates a new event for the authenticated user',
  })
  @ApiBody({
    description: 'Event data to create',
    type: CreateEventDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Event created successfully.',
  })
  async createEvent(
    @Body() dto: CreateEventDto,
    @Res() res: Response,
    // @Req() req: Request,
  ) {
    //   const userId = (req as any).user?.id;
    const result = await this.eventService.createEvent(dto);

    return sendResponse(res, {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Event created successfully',
      data: result,
    });
  }

  // Update event
  @Put('update-event/:eventId')
  @Roles(userRole.ADMIN)
  @ApiOperation({
    summary: 'Update an event',
    description: 'Updates an existing event (only owner can update)',
  })
  @ApiBody({
    description: 'Event data to update',
    type: UpdateEventDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Event updated successfully.',
  })
  async updateEvent(
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventDto,
    @Res() res: Response,
    // @Req() req: Request,
  ) {
    //   const userId = (req as any).user?.id;
    const result = await this.eventService.updateEvent(eventId, dto);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Event updated successfully',
      data: result,
    });
  }

  // Get all events
  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get all events',
    description: 'Retrieves all available events',
  })
  @ApiResponse({
    status: 200,
    description: 'Events retrieved successfully.',
  })
  async getAllEvents(@Res() res: Response) {
    const result = await this.eventService.getAllEvents();

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Events retrieved successfully',
      data: result,
    });
  }

  @Get('attendedEventByUser')
  @Roles(userRole.ADMIN, userRole.USER)
  @ApiResponse({
    status: 200,
    description: 'Attended events and stats retrieved successfully',
  })
  async getAttendedEvents(@Res() res: Response, @Req() req: Request) {
    const userId = (req as any).user?.id;
    const result = await this.eventService.getAttendedEventsWithStats(userId);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Attended events retrieved successfully',
      data: result,
    });
  }

  @Get('joinEventByUser')
  @Roles(userRole.ADMIN, userRole.USER)
  @ApiResponse({
    status: 200,
    description: 'Attended events and stats retrieved successfully',
  })
  async getJoinEvents(@Res() res: Response, @Req() req: Request) {
    const userId = (req as any).user?.id;
    const result = await this.eventService.getJoinEventsWithStats(userId);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Attended events retrieved successfully',
      data: result,
    });
  }

  @Public()
  @Get('upcoming')
  async getUpcomingEvents(@Res() res: Response) {
    const result = await this.eventService.getUpcomingEvents();
    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Upcoming events retrieved successfully',
      data: result,
    });
  }

  // Get event by ID
  @Public()
  @Get(':eventId')
  @ApiOperation({
    summary: 'Get event by ID',
    description: 'Retrieves a specific event with all enrolled students',
  })
  @ApiResponse({
    status: 200,
    description: 'Event retrieved successfully.',
  })
  async getEventById(@Param('eventId') eventId: string, @Res() res: Response) {
    const result = await this.eventService.getEventById(eventId);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Event retrieved successfully',
      data: result,
    });
  }

  @Delete(':eventId')
  @Roles(userRole.ADMIN)
  @ApiOperation({
    summary: 'Delete an event',
    description: 'Deletes an event (only owner can delete)',
  })
  @ApiResponse({
    status: 200,
    description: 'Event deleted successfully.',
  })
  async deleteEvent(
    @Param('eventId') eventId: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    // const userId = (req as any).user?.id;
    const result = await this.eventService.deleteEvent(eventId);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Event deleted successfully',
      data: result,
    });
  }
}
