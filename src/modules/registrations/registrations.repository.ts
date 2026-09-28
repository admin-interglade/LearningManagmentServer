import { EntityManager } from 'typeorm';
import { repo } from '../../common/utils/db';
import { REGISTRATION_STATUS } from '../../common/constants/statuses';
import { Registration } from './entities/registration.entity';

export const registrationsRepository = {
  findById: (registrationId: string, manager?: EntityManager) =>
    repo(Registration, manager).findOne({ where: { registrationId }, relations: { exam: true } }),

  findByIdForUpdate: (registrationId: string, manager: EntityManager) =>
    repo(Registration, manager).findOne({ where: { registrationId }, lock: { mode: 'pessimistic_write' } }),

  findByStudentAndExam: (studentId: string, examId: string, manager?: EntityManager) =>
    repo(Registration, manager).findOne({ where: { studentId, examId } }),

  findConfirmed: (studentId: string, examId: string, manager?: EntityManager) =>
    repo(Registration, manager).findOne({
      where: { studentId, examId, registrationStatus: REGISTRATION_STATUS.CONFIRMED },
    }),

  findByStudent: (studentId: string) =>
    repo(Registration).find({ where: { studentId }, relations: { exam: true }, order: { createdAt: 'DESC' } }),

  create: (data: Partial<Registration>, manager: EntityManager) =>
    repo(Registration, manager).save(repo(Registration, manager).create(data)),

  save: (registration: Registration, manager?: EntityManager) => repo(Registration, manager).save(registration),
};
