package com.iodev.practicum.repository;

import com.iodev.practicum.model.StudentRegistration;
import org.springframework.data.jpa.repository.JpaRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Ang REJECTED, REVOKED at EMAIL_PENDING ay hindi binibilang sa pagsusuri ng kapareho (puwedeng mag-register ulit).
 * Ang hindi pa na-verify na email ay hindi humaharang: ang unang mag-verify ang nananalo.
 */
public interface StudentRegistrationRepository extends JpaRepository<StudentRegistration, Long> {

    /** Pending at mga na-reject, pinakaluma ang una; ang VERIFIED ay nasa Students list na */
    @Query("select r from StudentRegistration r where r.coordinator.id = :coordinatorId "
            + "and r.semester.id = :semesterId and r.status in ('PENDING', 'REJECTED') order by r.createdAt")
    List<StudentRegistration> findOpenAndRejected(@Param("coordinatorId") Long coordinatorId,
                                                  @Param("semesterId") Long semesterId);

    @Query("select count(r) > 0 from StudentRegistration r where lower(r.studentNumber) = lower(:number) "
            + "and r.semester.id = :semesterId and r.status in ('PENDING', 'VERIFIED') "
            + "and (:excludeId is null or r.id <> :excludeId)")
    boolean numberTaken(@Param("number") String number, @Param("semesterId") Long semesterId,
                        @Param("excludeId") Long excludeId);

    /**
     * PENDING lang ang humaharang. Ang VERIFIED na may student_id ay ang students table na ang bahala
     * (kaya hindi na humaharang ang lumang email kapag pinalitan o tinanggal ng coordinator ang email ng student).
     */
    @Query("select count(r) > 0 from StudentRegistration r where lower(trim(r.email)) = lower(:email) "
            + "and (r.status = 'PENDING' or (r.status = 'VERIFIED' and r.studentId is null)) "
            + "and (:excludeId is null or r.id <> :excludeId)")
    boolean emailTaken(@Param("email") String email, @Param("excludeId") Long excludeId);

    /** Lahat ng registration ng coordinator sa semester (lahat ng status), pinakaluma ang una */
    @Query("select r from StudentRegistration r where r.coordinator.id = :coordinatorId "
            + "and r.semester.id = :semesterId order by r.createdAt")
    List<StudentRegistration> findAllFor(@Param("coordinatorId") Long coordinatorId,
                                         @Param("semesterId") Long semesterId);

    /** Hindi pa na-verify ang email, ayon sa email (para sa resend at sa pagpapalit ng lumang registration) */
    @Query("select r from StudentRegistration r where r.status = 'EMAIL_PENDING' "
            + "and lower(r.email) = lower(:email) order by r.createdAt desc")
    List<StudentRegistration> findUnverifiedByEmail(@Param("email") String email);

    Optional<StudentRegistration> findFirstByStudentIdOrderByIdDesc(Long studentId);

    /** Naka-lock habang vine-verify, para hindi makagawa ng dalawang account kapag dalawang beses na-click */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from StudentRegistration r where r.id = :id")
    Optional<StudentRegistration> findForUpdate(@Param("id") Long id);

    /** Binubura ang hindi na-verify na registration na mas luma sa :cutoff (7 araw) */
    @Modifying
    @Query("delete from StudentRegistration r where r.status = 'EMAIL_PENDING' and r.createdAt < :cutoff")
    int deleteUnverifiedBefore(@Param("cutoff") LocalDateTime cutoff);

    /** Para sa login: ang pinakabagong hindi pa tapos o rejected na may ganitong email o Student ID */
    @Query("select r from StudentRegistration r where r.status in ('EMAIL_PENDING', 'PENDING', 'REJECTED') "
            + "and (lower(r.email) = lower(:identifier) or lower(r.studentNumber) = lower(:identifier)) "
            + "order by r.createdAt desc")
    List<StudentRegistration> findForLogin(@Param("identifier") String identifier);

    @Query("select r.status, count(r) from StudentRegistration r "
            + "where r.coordinator.id = :coordinatorId and r.semester.id = :semesterId group by r.status")
    List<Object[]> countByStatus(@Param("coordinatorId") Long coordinatorId, @Param("semesterId") Long semesterId);
}
