package com.iodev.practicum.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.sql.Timestamp;

@Entity
@Table(name = "private_document_messages",
       indexes = @Index(name = "idx_pdm_file", columnList = "file_type, file_id"))
public class PrivateDocumentMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "file_id", nullable = false)
    private Long fileId;

    @Enumerated(EnumType.STRING)
    @Column(name = "file_type", nullable = false, length = 40)
    private MessageFileType fileType;

    @Enumerated(EnumType.STRING)
    @Column(name = "sender_type", nullable = false, length = 30)
    private MessageSenderType senderType;

    @Column(name = "sender_id", nullable = false)
    private Long senderId;

    @Column(name = "receiver_id", nullable = false)
    private Long receiverId;

    @Column(columnDefinition = "LONGTEXT", nullable = false)
    private String message;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public PrivateDocumentMessage() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getFileId() { return fileId; }
    public void setFileId(Long fileId) { this.fileId = fileId; }

    public MessageFileType getFileType() { return fileType; }
    public void setFileType(MessageFileType fileType) { this.fileType = fileType; }

    public MessageSenderType getSenderType() { return senderType; }
    public void setSenderType(MessageSenderType senderType) { this.senderType = senderType; }

    public Long getSenderId() { return senderId; }
    public void setSenderId(Long senderId) { this.senderId = senderId; }

    public Long getReceiverId() { return receiverId; }
    public void setReceiverId(Long receiverId) { this.receiverId = receiverId; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}