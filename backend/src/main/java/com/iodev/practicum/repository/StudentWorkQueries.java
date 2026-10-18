package com.iodev.practicum.repository;

import com.iodev.practicum.model.MonthlyDtr;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/** Mga listahan ng DTR at weekly report para sa student (hindi kasama ang naka-archive) */
public interface StudentWorkQueries extends JpaRepository<MonthlyDtr, Long> {

    @Query("select d from MonthlyDtr d where d.coordinator.id = :coordinatorId and d.semester.id = :semesterId "
            + "and (d.isArchived is null or d.isArchived = 0) order by d.dueDate, d.id")
    List<MonthlyDtr> dtrsFor(@Param("coordinatorId") Long coordinatorId, @Param("semesterId") Long semesterId);
}
