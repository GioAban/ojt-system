package com.iodev.practicum.dto;

import java.util.List;

public record CompanyOptionResponse(
        Long id,
        String name,
        String address,
        String location,
        String contactNumber,
        String nature,
        String description,
        String supervisorName,
        String supervisorPosition,
        List<DepartmentOption> departments) {

    public record DepartmentOption(
            Long id,
            String name,
            int slots,
            long filled,
            boolean current,
            String supervisorFullname,
            String supervisorPosition,
            String supervisorContactNumber,
            String supervisorEmail,
            String status,
            String moaStart,
            String moaExpiration) {}
}