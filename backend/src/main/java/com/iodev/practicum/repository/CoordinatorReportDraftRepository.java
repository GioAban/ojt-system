package com.iodev.practicum.repository;

import com.iodev.practicum.model.CoordinatorReportDraft;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CoordinatorReportDraftRepository extends JpaRepository<CoordinatorReportDraft, Long> {
    Optional<CoordinatorReportDraft> findByCoordinatorIdAndSemesterIdAndReportType(Long coordinatorId, Long semesterId,
                                                                                 String reportType);
}
