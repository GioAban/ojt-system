package com.iodev.practicum.controller;

import com.iodev.practicum.dto.StudentProfileDtos.NotificationItem;
import com.iodev.practicum.dto.StudentProfileDtos.NotificationsResponse;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.CoordinatorNotification;
import com.iodev.practicum.repository.CoordinatorNotificationRepository;
import com.iodev.practicum.repository.CoordinatorRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** Mga abiso ng coordinator: nag-turn in o nag-comment ang student. */
@RestController
@RequestMapping("/api/coordinator/notifications")
public class CoordinatorNotificationsController {

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private CoordinatorNotificationRepository repository;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list(Authentication authentication) {
        Coordinator c = coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
        if (c == null) return ResponseEntity.status(403).body("Coordinator profile not found.");

        List<NotificationItem> items = new ArrayList<>();
        for (CoordinatorNotification n : repository.findTop50ByCoordinatorIdOrderByCreatedAtDesc(c.getId())) {
            items.add(new NotificationItem("c" + n.getId(), n.getType(), n.getTitle(), n.getMessage(),
                    n.getCreatedAt() == null ? "" : n.getCreatedAt().toInstant().toString(),
                    n.getReadAt() == null, n.getLink()));
        }
        int unread = (int) repository.countByCoordinatorIdAndReadAtIsNull(c.getId());
        return ResponseEntity.ok(new NotificationsResponse(unread, items));
    }

    @PostMapping("/read")
    @Transactional
    public ResponseEntity<?> markAllRead(Authentication authentication) {
        Coordinator c = coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
        if (c == null) return ResponseEntity.status(403).body("Coordinator profile not found.");
        repository.markAllRead(c.getId(), LocalDateTime.now());
        return ResponseEntity.ok().build();
    }
}
