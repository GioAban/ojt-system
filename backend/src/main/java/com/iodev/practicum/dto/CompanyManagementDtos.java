package com.iodev.practicum.dto;

import com.iodev.practicum.model.DepartmentMoaFile;

import java.util.List;

public final class CompanyManagementDtos {

    private CompanyManagementDtos() {}

    public record MoaFileItem(Long id, String name, String contentType, long size, String uploadedAt) {
        public static MoaFileItem from(DepartmentMoaFile f) {
            return new MoaFileItem(
                    f.getId(), f.getOriginalName(), f.getContentType(), f.getFileSize(),
                    f.getUploadedAt() == null ? null : f.getUploadedAt().toLocalDate().toString());
        }
    }

    public record DepartmentItem(
            Long id, String name, int slots, long filled,
            String supervisorFullname, String supervisorPosition,
            String supervisorContactNumber, String supervisorEmail,
            String status, String moaStart, String moaExpiration, boolean archived,
            List<MoaFileItem> moaFiles) {}

    public record CompanyItem(
            Long id, String name, String address, String location, String contactNumber,
            Long natureId, String nature, String description,
            String supervisorName, String supervisorPosition, String idType, String idNumber,
            boolean archived, long placed, int slots, List<DepartmentItem> departments) {}

    public record NatureItem(Long id, String name) {}

    public record CompaniesResponse(Long semesterId, List<CompanyItem> companies, List<NatureItem> natures) {}

    public record CompanyRequest(
            Long semesterId, String name, String address, String location, String contactNumber,
            Long natureId, String description, String supervisorName, String supervisorPosition,
            String idType, String idNumber) {}

    public record DepartmentRequest(
            String name, Integer slots, String supervisorFullname, String supervisorPosition,
            String supervisorContactNumber, String supervisorEmail, String status,
            String moaStart, String moaExpiration) {}

    public record ApprovalRequest(String status) {}
}