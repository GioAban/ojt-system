package com.iodev.practicum.repository;

import com.iodev.practicum.model.EnrollmentLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface EnrollmentLinkRepository extends JpaRepository<EnrollmentLink, Long> {

    Optional<EnrollmentLink> findByToken(String token);

    @Query("select l from EnrollmentLink l where l.coordinator.id = :coordinatorId and l.semester.id = :semesterId")
    Optional<EnrollmentLink> findFor(@Param("coordinatorId") Long coordinatorId,
                                     @Param("semesterId") Long semesterId);
}
