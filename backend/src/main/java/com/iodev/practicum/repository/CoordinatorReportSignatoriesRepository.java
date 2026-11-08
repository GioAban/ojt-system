package com.iodev.practicum.repository;

import com.iodev.practicum.model.CoordinatorReportSignatories;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CoordinatorReportSignatoriesRepository extends JpaRepository<CoordinatorReportSignatories, Long> {
    Optional<CoordinatorReportSignatories> findByCoordinatorId(Long coordinatorId);
}
