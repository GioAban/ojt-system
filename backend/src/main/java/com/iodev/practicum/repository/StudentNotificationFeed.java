package com.iodev.practicum.repository;

import com.iodev.practicum.model.StudentNotification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StudentNotificationFeed extends JpaRepository<StudentNotification, Long> {

    List<StudentNotification> findTop50ByStudentIdOrderByCreatedAtDesc(Long studentId);
}
