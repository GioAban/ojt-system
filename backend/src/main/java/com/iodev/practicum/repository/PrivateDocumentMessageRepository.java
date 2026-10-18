package com.iodev.practicum.repository;

import com.iodev.practicum.model.MessageFileType;
import com.iodev.practicum.model.PrivateDocumentMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface PrivateDocumentMessageRepository extends JpaRepository<PrivateDocumentMessage, Long> {

    List<PrivateDocumentMessage> findByFileTypeAndFileIdOrderByCreatedAtAsc(MessageFileType fileType, Long fileId);

    List<PrivateDocumentMessage> findByFileTypeAndFileIdInOrderByCreatedAtAscIdAsc(
            MessageFileType fileType, Collection<Long> fileIds);
}
