package com.iodev.practicum.repository;

import com.iodev.practicum.model.MonthlyWeeklyReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StudentWeeklyQueries extends JpaRepository<MonthlyWeeklyReport, Long> {

    @Query("select r from MonthlyWeeklyReport r where r.coordinator.id = :coordinatorId and r.semester.id = :semesterId "
            + "and (r.isArchived is null or r.isArchived = false) order by r.monthFrom, r.id")
    List<MonthlyWeeklyReport> weeksFor(@Param("coordinatorId") Long coordinatorId, @Param("semesterId") Long semesterId);
}
