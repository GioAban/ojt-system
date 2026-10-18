package com.iodev.practicum.repository;

import com.iodev.practicum.model.StudentNotification;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentNotificationRepository extends JpaRepository<StudentNotification, Long> {
}
