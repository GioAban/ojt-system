package com.iodev.practicum.repository;

import com.iodev.practicum.model.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * Mga query para sa Students page. Hiwalay ito sa StudentRepository
 * para hindi magalaw ang mga umiiral na.
 */
public interface StudentManagementRepository extends JpaRepository<Student, Long> {

    /** Lahat ng student ng coordinator sa semester, kasama ang archived */
    @Query("select s from Student s left join fetch s.department d left join fetch d.company "
            + "where s.coordinator.id = :coordinatorId and s.semester.id = :semesterId "
            + "order by s.lastname, s.firstname")
    List<Student> findForManagement(@Param("coordinatorId") Long coordinatorId,
                                    @Param("semesterId") Long semesterId);

    @Query("select count(s) > 0 from Student s "
            + "where lower(s.studentNumber) = lower(:number) and s.semester.id = :semesterId")
    boolean numberExists(@Param("number") String number, @Param("semesterId") Long semesterId);

    @Query("select count(s) > 0 from Student s "
            + "where lower(s.studentNumber) = lower(:number) and s.semester.id = :semesterId "
            + "and s.id <> :id")
    boolean numberExistsExcluding(@Param("number") String number,
                                  @Param("semesterId") Long semesterId,
                                  @Param("id") Long id);

    @Query("select count(s) > 0 from Student s where lower(s.email) = lower(:email)")
    boolean emailExists(@Param("email") String email);

    @Query("select count(s) > 0 from Student s where lower(s.email) = lower(:email) and s.id <> :id")
    boolean emailExistsExcluding(@Param("email") String email, @Param("id") Long id);

    @Query("select s from Student s where lower(s.email) = lower(:email)")
    List<Student> findByEmail(@Param("email") String email);

    /** Mga student na may account at ganitong Student ID; pinakabagong semester ang una */
    @Query("select s from Student s where lower(s.studentNumber) = lower(:number) "
            + "and s.email is not null and s.email <> '' and (s.isArchived is null or s.isArchived = false) "
            + "order by s.semester.id desc")
    List<Student> findLoginCandidates(@Param("number") String number);

    @Query("select s from Student s where lower(s.studentNumber) = lower(:number) "
            + "and s.semester.id = :semesterId and s.coordinator.id = :coordinatorId")
    List<Student> findByNumber(@Param("number") String number,
                               @Param("semesterId") Long semesterId,
                               @Param("coordinatorId") Long coordinatorId);
}
