package com.iodev.practicum.repository;

import com.iodev.practicum.model.WeeklyReportDraft;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface WeeklyReportDraftRepository extends JpaRepository<WeeklyReportDraft, Long> {
    Optional<WeeklyReportDraft> findByStudentIdAndMonthlyWeeklyReportId(Long studentId, Long monthlyWeeklyReportId);

    /** student id, pinakahuling pag-save ng draft */
    @Query("select d.studentId, max(d.updatedAt) from WeeklyReportDraft d where d.studentId in :studentIds group by d.studentId")
    List<Object[]> lastSaved(@Param("studentIds") Collection<Long> studentIds);
}
