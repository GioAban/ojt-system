package com.iodev.practicum.repository;
import com.iodev.practicum.model.Announcement;
import org.springframework.data.jpa.repository.JpaRepository;
public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {}