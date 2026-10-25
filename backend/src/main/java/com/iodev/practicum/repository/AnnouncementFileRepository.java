package com.iodev.practicum.repository;

import com.iodev.practicum.model.AnnouncementFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AnnouncementFileRepository extends JpaRepository<AnnouncementFile, Long> {

    List<AnnouncementFile> findByAnnouncementIdIn(Collection<Long> announcementIds);

    List<AnnouncementFile> findByAnnouncementIdOrderByIdAsc(Long announcementId);

    long countByAnnouncementId(Long announcementId);

    Optional<AnnouncementFile> findByIdAndAnnouncementId(Long id, Long announcementId);
}
