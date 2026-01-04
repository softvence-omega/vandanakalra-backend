import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/module/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
// import { RegisterDto } from './dto/register.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { getTokens } from './auth.utils';
import { MailerService } from '@nestjs-modules/mailer';
// import { SystemRole } from '@prisma/client';
import { RegisterDto } from './dto/register.dto';
import { userRole } from '@prisma/client';
import {
  AccountActiveDto,
  ChangePasswordDto,
  UpdateUserProfileDto,
} from './dto/update-account.dto';
import { NotificationService } from '../notification/notification.service';
import { CreateAttendanceDto } from './dto/attendence.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailerService: MailerService,
    private notification: NotificationService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (existingUser) {
      throw new BadRequestException('Username is already registered!');
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      parseInt(process.env.SALT_ROUND!),
    );

    const newUser = await this.prisma.user.create({
      data: {
        firstname: dto.firstName,
        lastname: dto.lastName,
        username: dto.username,
        password: hashedPassword,
        fcmToken: dto.fcmToken,
      },
    });

    const tokens = await getTokens(
      this.jwtService,
      newUser.id,
      newUser.username,
      newUser.role,
      newUser.firstname,
      newUser.lastname,
    );
    return { user: newUser, ...tokens };
  }

  // login
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (!user || !dto.password || !dto.fcmToken || !dto.role) {
      throw new ForbiddenException('Invalid credentials');
    }

    if (user.role !== dto.role) {
      throw new ForbiddenException(`${dto.role} role is not allowed here `);
    }


    if (!user.isActive) {
      throw new ForbiddenException('Your account is not Active yet!');
    }

    if (user.isDeleted) {
      throw new BadRequestException('User is deleted!');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new ForbiddenException('Invalid credentials');
    }
     
    const updateToken = await this.prisma.user.update({
      where: { username: dto.username },
      data: { fcmToken: dto.fcmToken },
    });

    const tokens = await getTokens(
      this.jwtService,
      user.id,
      user.username,
      user.role,
      user.firstname,
      user.lastname,
    );

    return { user, ...tokens };
  }

  async active_account(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    if (user.isDeleted) {
      throw new BadRequestException('User is deleted!');
    }

    const updateUser = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
      select: {
        // Specify the fields to return
        id: true,
        isActive: true,
        fcmToken: true, // Include the fcmToken field in the result
      },
    });

    // const user = await this.userService.findById(userId);
    // const response = await this.notification.sendPushNotification(
    //   updateUser.fcmToken as string,
    //   'Registration Approved!',
    //   'Your account has been approved By admin . You can now log in .',
    //   { status: 'approved' },
    // );

    return { updateUser };
  }

  // change password
  async changePassword(id: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || !user.password) {
      throw new NotFoundException('User not found');
    }
    if (user.isDeleted) {
      throw new BadRequestException('The account is deleted!');
    }
    const isMatch = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Old password is incorrect');
    }

    const hashed = await bcrypt.hash(
      dto.newPassword,
      parseInt(process.env.SALT_ROUND!),
    );
    await this.prisma.user.update({
      where: { id },
      data: { password: hashed },
    });

    return { message: 'Password changed successfully' };
  }
  // refresh token
  async refreshTokens(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.REFRESH_TOKEN_SECRET,
      });

      const user = await this.prisma.user.findUnique({
        where: { username: payload.username },
      });
      if (!user) throw new UnauthorizedException('Invalid refresh token');
      // if(!user.isDeleted){
      //  throw new BadRequestException('User is blocked!');
      // }
      return getTokens(
        this.jwtService,
        user.id,
        user.username,
        user.role,
        user.firstname,
        user.lastname,
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  //update profile
  async updateProfile(
    userId: string,
    dto: UpdateUserProfileDto,
    imageUrl: string | null,
  ) {
    // Optional: Validate that user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Update only provided fields
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstname !== undefined && { firstname: dto.firstname }),
        ...(dto.lastname !== undefined && { lastname: dto.lastname }),
        ...(imageUrl !== null && { image: imageUrl }),
        updatedAt: new Date(), // Optional: Prisma @updatedAt handles this automaticall
      },
    });

    // Omit sensitive fields like password
    const { password, ...safeUser } = updatedUser;
    return safeUser;
  }

  async createAttendance(userId: string, dto: CreateAttendanceDto) {
    // 1. Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. Define today's date range in UTC (or use your app's timezone consistently)
    const today = new Date();
    const startOfDay = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const endOfDay = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    // 3. Check if attendance already exists for this user today
    const existingAttendance = await this.prisma.attendence.findFirst({
      where: {
        userId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (existingAttendance) {
      throw new BadRequestException('Attendance already recorded for today');
    }

    // 4. Create new attendance
    const attendance = await this.prisma.attendence.create({
      data: {
        userId,
      },
    });

    return attendance;
  }

  async getAttendanceByDate(date: string) {
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
    }

    // Normalize to start/end of day (UTC or local — adjust if needed)
    const startOfDay = new Date(parsedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(parsedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const attendances = await this.prisma.attendence.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return attendances;
  }

  async forgotPassword(username: string, fcmToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    // Still avoid user enumeration → silently succeed if not found
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate 4-digit numeric token
    const resetToken = Math.floor(1000 + Math.random() * 9000).toString(); // e.g. "4829"
    const resetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const userUpdate=await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetExpires,
      },
    });

    // Send FCM with 4-digit code (user can type it, or app deep-links it)
    // const response = await this.notification.sendPushNotification(
    //   fcmToken,
    //   'Password Reset Code',
    //   `Your code: ${resetToken}. Valid for 10 minutes`,
    //   { status: 'success' },
    // );

    return userUpdate
  }

  async resetPassword(token: string, newPassword: string){
    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          gte: new Date(), // greater than or equal to now → not expired
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

        return updateUser

  }
}
