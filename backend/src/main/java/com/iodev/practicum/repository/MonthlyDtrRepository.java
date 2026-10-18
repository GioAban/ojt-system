package com.iodev.practicum.repository;

import com.iodev.practicum.model.MonthlyDtr;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MonthlyDtrRepository extends JpaRepository<MonthlyDtr, Long> {

    @Query("select d from MonthlyDtr d "
            + "where d.coordinator.id = :coordinatorId and d.semester.id = :semesterId and d.isArchived = 0 "
            + "order by d.id")
    List<MonthlyDtr> findForTracking(@Param("coordinatorId") Long coordinatorId,
                                     @Param("semesterId") Long semesterId);

    @Query("select d from MonthlyDtr d "
            + "where d.coordinator.id = :coordinatorId and d.semester.id = :semesterId and d.isArchived <> 0 "
            + "order by d.id")
    List<MonthlyDtr> findArchivedForManagement(@Param("coordinatorId") Long coordinatorId,
                                               @Param("semesterId") Long semesterId);

    @Query("select count(d) > 0 from MonthlyDtr d "
            + "where d.coordinator.id = :coordinatorId and d.semester.id = :semesterId and d.isArchived = 0 "
            + "and lower(d.month) = lower(:month)")
    boolean monthExists(@Param("coordinatorId") Long coordinatorId,
                        @Param("semesterId") Long semesterId,
                        @Param("month") String month);

    @Query("select count(d) > 0 from MonthlyDtr d "
            + "where d.coordinator.id = :coordinatorId and d.semester.id = :semesterId and d.isArchived = 0 "
            + "and lower(d.month) = lower(:month) and d.id <> :excludeId")
    boolean monthExistsExcluding(@Param("coordinatorId") Long coordinatorId,
                                 @Param("semesterId") Long semesterId,
                                 @Param("month") String month,
                                 @Param("excludeId") Long excludeId);
}
