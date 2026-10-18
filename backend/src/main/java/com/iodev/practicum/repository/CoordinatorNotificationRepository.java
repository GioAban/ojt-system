package com.iodev.practicum.repository;

import com.iodev.practicum.model.CoordinatorNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface CoordinatorNotificationRepository extends JpaRepository<CoordinatorNotification, Long> {

    List<CoordinatorNotification> findTop50ByCoordinatorIdOrderByCreatedAtDesc(Long coordinatorId);

    long countByCoordinatorIdAndReadAtIsNull(Long coordinatorId);

    @Modifying
    @Query("update CoordinatorNotification n set n.readAt = :now "
            + "where n.coordinatorId = :coordinatorId and n.readAt is null")
    int markAllRead(@Param("coordinatorId") Long coordinatorId, @Param("now") LocalDateTime now);
}
