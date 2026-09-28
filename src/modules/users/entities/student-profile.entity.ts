import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('student_profiles')
export class StudentProfile {
  @PrimaryGeneratedColumn('uuid', { name: 'student_id' })
  studentId: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User, (user) => user.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
  lastName: string | null;

  @Column({ name: 'school_name', type: 'varchar', length: 255, nullable: true })
  schoolName: string | null;

  @Column({ name: 'class_name', type: 'varchar', length: 100, nullable: true })
  className: string | null;

  @Column({ name: 'contact_details', type: 'text', nullable: true })
  contactDetails: string | null;
}
