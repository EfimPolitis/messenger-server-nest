import { AuthRegisterDto } from '@/auth/dto/auth.dto';
import {
  IGithubProfile,
  IGoogleProfile,
} from '@/auth/social-media/social-media-auth.types';
import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { hash } from 'argon2';

import { PrismaService } from 'src/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getUsers(userData: string) {
    return this.prisma.user.findMany({
      where: {
        OR: [
          {
            name: {
              contains: userData,
              mode: 'insensitive',
            },
          },
          {
            surname: {
              contains: userData,
              mode: 'insensitive',
            },
          },
          {
            email: {
              contains: userData,
              mode: 'insensitive',
            },
          },
        ],
      },
      select: {
        name: true,
        surname: true,
        email: true,
        avatarPath: true,
        id: true,
        password: false,
      },
    });
  }

  async getById(id: string) {
    return this.prisma.user.findUnique({
      where: {
        id,
      },
    });
  }

  async getByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: {
        email,
      },
    });
  }

  async findOrCreateSocialUser(profile: IGoogleProfile | IGithubProfile) {
    let user = await this.getByEmail(profile.email);
    if (!user) {
      user = await this._createSocialUser(profile);
    }
    return user;
  }

  private async _createSocialUser(
    profile: IGoogleProfile | IGithubProfile
  ): Promise<User> {
    const email = profile.email;
    const name =
      'firstName' in profile
        ? `${profile.firstName} ${profile.lastName}`
        : profile.username;
    const picture = profile.picture || '';

    return this.prisma.user.create({
      data: {
        email,
        name,
        surname: '',
        password: '',
        verificationToken: null,
        avatarPath: picture,
      },
    });
  }

  async create(dto: AuthRegisterDto) {
    return this.prisma.user.create({
      data: {
        name: dto.name,
        surname: dto.surname,
        email: dto.email,
        password: await hash(dto.password),
      },
    });
  }

  async update(id: string, data: Partial<User>) {
    return this.prisma.user.update({
      where: {
        id,
      },
      data,
    });
  }
}
