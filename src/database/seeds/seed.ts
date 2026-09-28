import 'reflect-metadata';
import { AppDataSource } from '../../config/data-source';
import { env } from '../../config/env';
import { ROLES } from '../../common/constants/roles';
import { hashPassword } from '../../common/utils/password';
import { Role } from '../../modules/users/entities/role.entity';
import { User } from '../../modules/users/entities/user.entity';

const ROLE_SEED = [
  { name: ROLES.STUDENT, description: 'Student taking exams' },
  { name: ROLES.ADMIN, description: 'Administrator managing exams, questions and reports' },
];

const run = async () => {
  await AppDataSource.initialize();
  const roleRepo = AppDataSource.getRepository(Role);
  const userRepo = AppDataSource.getRepository(User);

  for (const role of ROLE_SEED) {
    if (!(await roleRepo.findOne({ where: { name: role.name } }))) {
      await roleRepo.save(roleRepo.create(role));
      console.log(`Created role: ${role.name}`);
    }
  }

  const adminEmail = env.seed.adminEmail.toLowerCase();
  if (await userRepo.findOne({ where: { email: adminEmail } })) {
    console.log(`Admin ${adminEmail} already exists`);
  } else if (!env.seed.adminPassword) {
    console.warn('SEED_ADMIN_PASSWORD is empty; skipping admin user creation');
  } else {
    const adminRole = await roleRepo.findOneOrFail({ where: { name: ROLES.ADMIN } });
    await userRepo.save(
      userRepo.create({
        roleId: adminRole.roleId,
        email: adminEmail,
        passwordHash: await hashPassword(env.seed.adminPassword),
        countryCode: 'IN',
        isActive: true,
      }),
    );
    console.log(`Created admin: ${adminEmail}`);
  }

  await AppDataSource.destroy();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
