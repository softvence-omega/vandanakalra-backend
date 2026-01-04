import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import sendResponse from '../utils/sendResponse';
import { Public } from 'src/common/decorators/public.decorators';
import type { Request, Response } from 'express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  AccountActiveDto,
  ChangePasswordDto,
  UpdateUserProfileDto,
} from './dto/update-account.dto';
import { CreateAttendanceDto } from './dto/attendence.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { userRole } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { CloudinaryService } from 'src/common/services/cloudinary.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // refresh token
  @Public()
  @Post('refresh-token')
  @ApiOperation({
    summary: 'Refresh JWT tokens',
    description: 'Refreshes the access token using the provided refresh token.',
  })
  @ApiBody({
    description: 'Refresh token for refreshing access token',
    type: RefreshTokenDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully.',
  })
  async refreshToken(
    @Body('refreshToken') token: string,
    @Res() res: Response,
  ) {
    const result = await this.authService.refreshTokens(token);
    res.cookie('accessToken', result.access_token, {
      httpOnly: false, // Prevents client-side access to the cookie
      secure: false, // Only true for HTTPS
      maxAge: 86400000, // 1 day expiration
      sameSite: 'none', // Allow cross-origin requests to send the cookie
    });

    res.cookie('refreshToken', result.refresh_token, {
      httpOnly: false,
      secure: false, // Only true for HTTPS
      maxAge: 604800000, // 7 days expiration
      sameSite: 'none', // Allow cross-origin requests to send the cookie
    });
    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Token refreshed',
      data: result,
    });
  }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res() res: Response) {
    const result = await this.authService.register(dto);

    res.cookie('accessToken', result.access_token, {
      httpOnly: false, // Prevents client-side access to the cookie
      secure: false, // Only true for HTTPS
      maxAge: 86400000, // 1 day expiration
      sameSite: 'none', // Allow cross-origin requests to send the cookie
    });

    res.cookie('refreshToken', result.refresh_token, {
      httpOnly: false,
      secure: false, // Only true for HTTPS
      maxAge: 604800000, // 7 days expiration
      sameSite: 'none', // Allow cross-origin requests to send the cookie
    });
    return sendResponse(res, {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Registration successful',
      data: result,
    });
  }

  // login
  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Res() res: Response) {
    const result = await this.authService.login(dto);
    res.cookie('accessToken', result.access_token, {
      httpOnly: false, // Prevents client-side access to the cookie
      secure: false, // Only true for HTTPS
      maxAge: 86400000, // 1 day expiration
      sameSite: 'none', // Allow cross-origin requests to send the cookie
    });

    res.cookie('refreshToken', result.refresh_token, {
      httpOnly: false,
      secure: false, // Only true for HTTPS
      maxAge: 604800000, // 7 days expiration
      sameSite: 'none', // Allow cross-origin requests to send the cookie
    });
    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Login successful',
      data: result,
    });
  }

  // change password
  @Patch('change-password')
  @Roles(userRole.ADMIN, userRole.USER)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.authService.changePassword(req.user!.id, dto);
    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Password changed',
      data: result,
    });
  }

  @Put('activate-account')
  @Roles(userRole.ADMIN)
  async active_account(
    @Body() dto: AccountActiveDto,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const result = await this.authService.active_account(dto.userId);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Account activated successfully',
      data: result,
    });
  }

  @Patch('update-profile')
  @Roles(userRole.ADMIN, userRole.USER)
  @UseInterceptors(
    FileInterceptor('image', { storage: multer.memoryStorage() }),
  )
  @ApiConsumes('multipart/form-data') // 👈 tells Swagger to use multipart
  @ApiBody({
    description: 'Update user profile with optional image upload',
    type: UpdateUserProfileDto, // 👈 use the new DTO here
  })
  @ApiOperation({ summary: 'Update user profile (with optional image)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
  })
  async updateProfile(
    @Req() req: any,
    @Body() updateDto: UpdateUserProfileDto,
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    const userId = req.user?.id;
    let imageUrl: string | null = null;

    if (file) {
      const result = await this.cloudinaryService.uploadImage(
        file,
        'profile-images',
      );
      imageUrl = result.secure_url; // This is valid now because imageUrl is typed as string | null
      // You probably want to save this URL to the user record
    }

    // Optional: update profile even if no image
    const updatedUser = await this.authService.updateProfile(userId, updateDto , imageUrl);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Profile updated successfully',
      data: { ...updatedUser },
    });
  }

  @Post('record-attendence')
  @Roles(userRole.USER, userRole.ADMIN)
  @ApiResponse({ status: 201, description: 'Attendance recorded successfully' })
  async createAttendance(@Res() res: Response, @Req() req: Request) {
    const userId = req.user!.id;
    const result = await this.authService.createAttendance(userId);

    return sendResponse(res, {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Attendance recorded successfully',
      data: result,
    });
  }

  @Get('get-attendence-ByDate')
  @Roles(userRole.ADMIN)
  @ApiQuery({
    name: 'date',
    type: String,
    description: 'Date in YYYY-MM-DD format',
    example: '2025-04-05',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Attendance list retrieved' })
  async getAttendanceByDate(@Query('date') date: string, @Res() res: Response) {
    const result = await this.authService.getAttendanceByDate(date);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Attendance records retrieved successfully',
      data: result,
    });
  }
}
