package com.iodev.practicum.repository;

import com.iodev.practicum.model.DocumentRequirement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DocumentRequirementRepository extends JpaRepository<DocumentRequirement, Long> {

    @Query("select r from DocumentRequirement r "
            + "where r.coordinator.id = :coordinatorId and r.semester.id = :semesterId "
            + "and r.type = :type and r.isArchived = false order by r.id")
    List<DocumentRequirement> findForTracking(@Param("coordinatorId") Long coordinatorId,
                                              @Param("semesterId") Long semesterId,
                                              @Param("type") String type);

    @Query("select r from DocumentRequirement r "
            + "where r.coordinator.id = :coordinatorId and r.semester.id = :semesterId "
            + "and r.type = :type and r.isArchived = :archived order by r.id")
    List<DocumentRequirement> findForManagement(@Param("coordinatorId") Long coordinatorId,
                                                @Param("semesterId") Long semesterId,
                                                @Param("type") String type,
                                                @Param("archived") boolean archived);

    @Query("select count(r) > 0 from DocumentRequirement r "
            + "where r.coordinator.id = :coordinatorId and r.semester.id = :semesterId "
            + "and r.type = :type and r.isArchived = false and lower(r.title) = lower(:title)")
    boolean titleExists(@Param("coordinatorId") Long coordinatorId,
                        @Param("semesterId") Long semesterId,
                        @Param("type") String type,
                        @Param("title") String title);

    @Query("select count(r) > 0 from DocumentRequirement r "
            + "where r.coordinator.id = :coordinatorId and r.semester.id = :semesterId "
            + "and r.type = :type and r.isArchived = false and lower(r.title) = lower(:title) "
            + "and r.id <> :excludeId")
    boolean titleExistsExcluding(@Param("coordinatorId") Long coordinatorId,
                                 @Param("semesterId") Long semesterId,
                                 @Param("type") String type,
                                 @Param("title") String title,
                                 @Param("excludeId") Long excludeId);
}
