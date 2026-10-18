package com.iodev.practicum.repository;

import com.iodev.practicum.model.DocumentRequirement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/** Mga query para sa Home ng student. Hiwalay para hindi magalaw ang mga umiiral na repository. */
public interface StudentRequirementQueries extends JpaRepository<DocumentRequirement, Long> {

    @Query("select r from DocumentRequirement r "
            + "where r.coordinator.id = :coordinatorId and r.semester.id = :semesterId and r.isArchived = false "
            + "order by r.dueDate, r.id")
    List<DocumentRequirement> findForStudent(@Param("coordinatorId") Long coordinatorId,
                                             @Param("semesterId") Long semesterId);
}
