package com.iodev.practicum.repository;

import com.iodev.practicum.model.WeeklyReportDraft;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WeeklyReportDraftRepository extends JpaRepository<WeeklyReportDraft, Long> {
    Optional<WeeklyReportDraft> findByStudentIdAndMonthlyWeeklyReportId(Long studentId, Long monthlyWeeklyReportId);
}
