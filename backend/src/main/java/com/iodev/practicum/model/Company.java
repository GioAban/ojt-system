package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;

@Entity
@Table(name = "companies")
public class Company {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "coordinator_id", nullable = false)
    private Coordinator coordinator;

    @ManyToOne
    @JoinColumn(name = "semester_id", nullable = false)
    private Semester semester;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String address;

    private String location;

    @Column(name = "contact_number", nullable = false)
    private String contactNumber;

    @Column(name = "imsup_fullname", nullable = false)
    private String imsupFullname;

    @Column(name = "imsup_position", nullable = false)
    private String imsupPosition;

    @Column(name = "imsup_comp_evid_identity")
    private String imsupCompEvidIdentity;

    @Column(name = "imsup_comp_evid_identity_no")
    private String imsupCompEvidIdentityNo;

    private String logo;

    @ManyToOne
    @JoinColumn(name = "nature_id")
    private CompanyNature nature;

    @Column(columnDefinition = "LONGTEXT")
    private String description;

    @Column(name = "is_archived", nullable = false)
    private Boolean isArchived = false;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public Company() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Coordinator getCoordinator() { return coordinator; }
    public void setCoordinator(Coordinator coordinator) { this.coordinator = coordinator; }

    public Semester getSemester() { return semester; }
    public void setSemester(Semester semester) { this.semester = semester; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getContactNumber() { return contactNumber; }
    public void setContactNumber(String contactNumber) { this.contactNumber = contactNumber; }

    public String getImsupFullname() { return imsupFullname; }
    public void setImsupFullname(String imsupFullname) { this.imsupFullname = imsupFullname; }

    public String getImsupPosition() { return imsupPosition; }
    public void setImsupPosition(String imsupPosition) { this.imsupPosition = imsupPosition; }

    public String getImsupCompEvidIdentity() { return imsupCompEvidIdentity; }
    public void setImsupCompEvidIdentity(String imsupCompEvidIdentity) { this.imsupCompEvidIdentity = imsupCompEvidIdentity; }

    public String getImsupCompEvidIdentityNo() { return imsupCompEvidIdentityNo; }
    public void setImsupCompEvidIdentityNo(String imsupCompEvidIdentityNo) { this.imsupCompEvidIdentityNo = imsupCompEvidIdentityNo; }

    public String getLogo() { return logo; }
    public void setLogo(String logo) { this.logo = logo; }

    public CompanyNature getNature() { return nature; }
    public void setNature(CompanyNature nature) { this.nature = nature; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Boolean getIsArchived() { return isArchived; }
    public void setIsArchived(Boolean isArchived) { this.isArchived = isArchived; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}