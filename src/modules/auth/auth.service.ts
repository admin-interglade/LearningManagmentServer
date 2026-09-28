import { AppError } from '../../common/errors/app-error';
import { ROLES, RoleName } from '../../common/constants/roles';
import { transaction } from '../../common/utils/db';
import { signAccessToken, signResetToken, verifyResetToken } from '../../common/utils/jwt';
import { comparePassword, hashPassword, passwordFingerprint } from '../../common/utils/password';
import { env } from '../../config/env';
import { User } from '../users/entities/user.entity';
import { usersRepository } from '../users/users.repository';
import { notificationsService } from '../notifications/notifications.service';
import { ChangePasswordBody, ForgotPasswordBody, LoginBody, RegisterBody, ResetPasswordBody } from './auth.validation';

const authResponse = (user: User) => {
  const { passwordHash: _omit, role, ...safeUser } = user;
  return {
    accessToken: signAccessToken({ sub: user.userId, role: role.name as RoleName }),
    tokenType: 'Bearer',
    expiresIn: env.jwt.accessExpiresIn,
    user: { ...safeUser, role: role.name },
  };
};

const register = async (body: RegisterBody) => {
  const email = body.email ?? null;
  const mobile = body.mobile ?? null;

  const user = await transaction(async (manager) => {
    if (await usersRepository.existsByEmailOrMobile(email, mobile, manager)) {
      throw AppError.conflict('An account with this email or mobile already exists');
    }
    const role = await usersRepository.findRoleByName(ROLES.STUDENT, manager);
    if (!role) throw new Error('Student role missing. Run the seed script.');

    const created = await usersRepository.createUser(
      { roleId: role.roleId, email, mobile, countryCode: body.country_code, passwordHash: await hashPassword(body.password), isActive: true },
      manager,
    );
    created.role = role;
    created.profile = await usersRepository.createProfile(
      {
        userId: created.userId,
        firstName: body.profile.first_name,
        lastName: body.profile.last_name ?? null,
        schoolName: body.profile.school_name ?? null,
        className: body.profile.class_name ?? null,
        contactDetails: body.profile.contact_details ?? null,
      },
      manager,
    );
    return created;
  });

  return authResponse(user);
};

const login = async (body: LoginBody) => {
  const user = await usersRepository.findByEmailOrMobileWithPassword(body.email_or_mobile);
  // Same error for unknown user and wrong password so accounts can't be enumerated
  if (!user || !(await comparePassword(body.password, user.passwordHash))) {
    throw AppError.unauthorized('Invalid credentials');
  }
  if (!user.isActive) throw AppError.forbidden('Account is disabled');
  return authResponse(user);
};

const forgotPassword = async (body: ForgotPasswordBody) => {
  const generic = { message: 'If an account exists, password reset instructions have been sent' };
  const user = await usersRepository.findByEmailOrMobileWithPassword(body.email_or_mobile);
  if (!user || !user.isActive) return generic;

  const token = signResetToken({ sub: user.userId, pwd: passwordFingerprint(user.passwordHash) });
  notificationsService.notifySafely({
    userId: user.userId,
    eventType: 'PASSWORD_RESET',
    payload: { reset_link: `${env.clientUrl}/reset-password?token=${encodeURIComponent(token)}` },
  });

  // Exposed outside production only, so the flow can be tested without an SMS/email provider
  return env.isProduction ? generic : { ...generic, resetToken: token };
};

const resetPassword = async (body: ResetPasswordBody) => {
  let payload;
  try {
    payload = verifyResetToken(body.token);
  } catch {
    throw AppError.badRequest('Reset token is invalid or expired');
  }
  const user = await usersRepository.findByIdWithPassword(payload.sub);
  // Fingerprint mismatch means the password already changed, so the token is single-use
  if (!user || !user.isActive || passwordFingerprint(user.passwordHash) !== payload.pwd) {
    throw AppError.badRequest('Reset token is invalid or expired');
  }
  await usersRepository.updatePassword(user.userId, await hashPassword(body.new_password));
  return { message: 'Password has been reset' };
};

const changePassword = async (userId: string, body: ChangePasswordBody) => {
  const user = await usersRepository.findByIdWithPassword(userId);
  if (!user) throw AppError.notFound('User not found');
  if (!(await comparePassword(body.current_password, user.passwordHash))) {
    throw AppError.badRequest('Current password is incorrect');
  }
  await usersRepository.updatePassword(userId, await hashPassword(body.new_password));
  return { message: 'Password changed' };
};

export const authService = { register, login, forgotPassword, resetPassword, changePassword };
