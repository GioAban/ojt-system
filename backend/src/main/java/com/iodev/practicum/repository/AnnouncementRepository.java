package com.iodev.practicum.repository;

import com.iodev.practicum.model.Announcement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {

    List<Announcement> findByCoordinatorIdAndSemesterIdOrderByIsPinnedDescCreatedAtDesc(Long coordinatorId, Long semesterId);
}
