package com.iodev.practicum.repository;

import com.iodev.practicum.model.StudentNotificationState;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentNotificationStateRepository extends JpaRepository<StudentNotificationState, Long> {
}
