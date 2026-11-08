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

    /** coordinator id, semester id, system key ng lahat ng built-in */
    @Query("select r.coordinator.id, r.semester.id, r.systemKey from DocumentRequirement r where r.systemKey is not null")
    List<Object[]> findBuiltInKeys();

    /** Mga built-in na wala pang Evaluation (ang form at mga criteria nito) */
    @Query("select r from DocumentRequirement r where r.systemKey is not null and not exists "
            + "(select 1 from Evaluation e where e.requirement = r)")
    List<DocumentRequirement> findBuiltInsWithoutForm();

    /** Mga aktibong karaniwang requirement na may ganitong pamagat (maliit na titik ang titles) */
    @Query("select r from DocumentRequirement r where r.systemKey is null and r.isArchived = false "
            + "and lower(r.type) = :type and lower(trim(r.title)) in :titles")
    List<DocumentRequirement> findAdoptable(@Param("type") String type, @Param("titles") List<String> titles);

    @Query("select r from DocumentRequirement r "
            + "where r.coordinator.id = :coordinatorId and r.semester.id = :semesterId and r.systemKey = :systemKey")
    java.util.Optional<DocumentRequirement> findBuiltIn(@Param("coordinatorId") Long coordinatorId,
                                                        @Param("semesterId") Long semesterId,
                                                        @Param("systemKey") String systemKey);
}
