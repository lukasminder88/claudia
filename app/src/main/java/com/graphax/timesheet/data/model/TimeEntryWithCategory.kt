package com.graphax.timesheet.data.model

import androidx.room.Embedded
import androidx.room.Relation

data class TimeEntryWithCategory(
    @Embedded val entry: TimeEntry,
    @Relation(parentColumn = "categoryId", entityColumn = "id")
    val category: Category
) {
    val durationMs: Long
        get() = (entry.endTime ?: System.currentTimeMillis()) - entry.startTime
}
