import { EntityManager } from 'typeorm';
import { repo } from '../../common/utils/db';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { StudentProfile } from './entities/student-profile.entity';

export const usersRepository = {
  findRoleByName: (name: string, manager?: EntityManager) => repo(Role, manager).findOne({ where: { name } }),

  findById: (userId: string, manager?: EntityManager) =>
    repo(User, manager).findOne({ where: { userId }, relations: { role: true, profile: true } }),

  findByIdWithPassword: (userId: string, manager?: EntityManager) =>
    repo(User, manager)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.userId = :userId', { userId })
      .getOne(),

  findByEmailOrMobileWithPassword: (emailOrMobile: string, manager?: EntityManager) =>
    repo(User, manager)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.profile', 'profile')
      .where('LOWER(user.email) = LOWER(:value) OR user.mobile = :value', { value: emailOrMobile })
      .getOne(),

  existsByEmailOrMobile: (email: string | null, mobile: string | null, manager?: EntityManager) => {
    const qb = repo(User, manager).createQueryBuilder('user');
    if (email) qb.orWhere('LOWER(user.email) = LOWER(:email)', { email });
    if (mobile) qb.orWhere('user.mobile = :mobile', { mobile });
    return qb.getExists();
  },

  createUser: (data: Partial<User>, manager?: EntityManager) => repo(User, manager).save(repo(User, manager).create(data)),

  createProfile: (data: Partial<StudentProfile>, manager?: EntityManager) =>
    repo(StudentProfile, manager).save(repo(StudentProfile, manager).create(data)),

  updatePassword: (userId: string, passwordHash: string, manager?: EntityManager) =>
    repo(User, manager).update({ userId }, { passwordHash }),

  countByRole: (roleName: string) =>
    repo(User).createQueryBuilder('user').innerJoin('user.role', 'role').where('role.name = :roleName', { roleName }).getCount(),
};
