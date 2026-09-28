import { repo } from '../../common/utils/db';
import { Exam } from '../exams/entities/exam.entity';
import { Registration } from '../registrations/entities/registration.entity';

export const studentsRepository = {
  // Published exams whose registration window is open and the student hasn't registered for
  findOpenExamsNotRegistered: (studentId: string) =>
    repo(Exam)
      .createQueryBuilder('exam')
      .where('exam.isPublished = true')
      .andWhere("exam.status IN ('registration_open', 'ongoing')")
      .andWhere('now() BETWEEN exam.registrationStart AND exam.registrationEnd')
      .andWhere((qb) => {
        const sub = qb
          .subQuery()
          .select('1')
          .from(Registration, 'r')
          .where('r.examId = exam.examId')
          .andWhere('r.studentId = :studentId')
          .getQuery();
        return `NOT EXISTS ${sub}`;
      })
      .setParameter('studentId', studentId)
      .orderBy('exam.examStart', 'ASC')
      .limit(10)
      .getMany(),
};
