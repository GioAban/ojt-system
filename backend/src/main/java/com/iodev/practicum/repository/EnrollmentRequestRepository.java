package com.iodev.practicum.repository;

import com.iodev.practicum.model.EnrollmentRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EnrollmentRequestRepository extends JpaRepository<EnrollmentRequest, Long> {

    @Query("select r from EnrollmentRequest r join fetch r.student "
            + "where r.coordinator.id = :coordinatorId and r.semester.id = :semesterId and r.status = 'PENDING' "
            + "order by r.createdAt")
    List<EnrollmentRequest> findPending(@Param("coordinatorId") Long coordinatorId,
                                        @Param("semesterId") Long semesterId);

    @Query("select r from EnrollmentRequest r where r.student.id = :studentId and r.status = 'PENDING'")
    Optional<EnrollmentRequest> findPendingByStudent(@Param("studentId") Long studentId);

    @Query("select count(r) > 0 from EnrollmentRequest r where lower(r.email) = lower(:email) and r.status = 'PENDING'")
    boolean pendingEmailExists(@Param("email") String email);

    @Query("select count(r) from EnrollmentRequest r "
            + "where r.coordinator.id = :coordinatorId and r.semester.id = :semesterId and r.status = 'PENDING'")
    long countPending(@Param("coordinatorId") Long coordinatorId, @Param("semesterId") Long semesterId);
}
