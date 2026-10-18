package com.iodev.practicum.repository;

import com.iodev.practicum.model.MonthlyWeeklyReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.sql.Date;
import java.util.List;

public interface MonthlyWeeklyReportRepository extends JpaRepository<MonthlyWeeklyReport, Long> {

    @Query("select r from MonthlyWeeklyReport r "
            + "where r.coordinator.id = :coordinatorId and r.semester.id = :semesterId and r.isArchived = false "
            + "order by r.monthFrom, r.id")
    List<MonthlyWeeklyReport> findForTracking(@Param("coordinatorId") Long coordinatorId,
                                              @Param("semesterId") Long semesterId);

    @Query("select r from MonthlyWeeklyReport r "
            + "where r.coordinator.id = :coordinatorId and r.semester.id = :semesterId "
            + "and r.isArchived = :archived order by r.monthFrom, r.id")
    List<MonthlyWeeklyReport> findForManagement(@Param("coordinatorId") Long coordinatorId,
                                                @Param("semesterId") Long semesterId,
                                                @Param("archived") boolean archived);

    @Query("select count(r) > 0 from MonthlyWeeklyReport r "
            + "where r.coordinator.id = :coordinatorId and r.semester.id = :semesterId and r.isArchived = false "
            + "and r.monthFrom = :dateFrom and r.monthTo = :dateTo")
    boolean periodExists(@Param("coordinatorId") Long coordinatorId,
                         @Param("semesterId") Long semesterId,
                         @Param("dateFrom") Date dateFrom,
                         @Param("dateTo") Date dateTo);

    @Query("select count(r) > 0 from MonthlyWeeklyReport r "
            + "where r.coordinator.id = :coordinatorId and r.semester.id = :semesterId and r.isArchived = false "
            + "and r.monthFrom = :dateFrom and r.monthTo = :dateTo and r.id <> :excludeId")
    boolean periodExistsExcluding(@Param("coordinatorId") Long coordinatorId,
                                  @Param("semesterId") Long semesterId,
                                  @Param("dateFrom") Date dateFrom,
                                  @Param("dateTo") Date dateTo,
                                  @Param("excludeId") Long excludeId);
}
