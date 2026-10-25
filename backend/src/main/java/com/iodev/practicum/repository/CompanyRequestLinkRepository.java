package com.iodev.practicum.repository;

import com.iodev.practicum.model.CompanyRequestLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CompanyRequestLinkRepository extends JpaRepository<CompanyRequestLink, Long> {

    Optional<CompanyRequestLink> findByToken(String token);

    @Query("select l from CompanyRequestLink l where l.coordinator.id = :coordinatorId and l.semester.id = :semesterId")
    Optional<CompanyRequestLink> findFor(@Param("coordinatorId") Long coordinatorId,
                                         @Param("semesterId") Long semesterId);
}
