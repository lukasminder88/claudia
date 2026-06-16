package com.graphax.timesheet.data.model

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "time_entries",
    foreignKeys = [ForeignKey(
        entity = Category::class,
        parentColumns = ["id"],
        childColumns = ["categoryId"],
        onDelete = ForeignKey.CASCADE
    )],
    indices = [Index("categoryId")]
)
data class TimeEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val categoryId: Long,
    val startTime: Long,
    val endTime: Long? = null,
    val note: String = ""
)
