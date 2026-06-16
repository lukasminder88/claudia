package com.graphax.timesheet.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.graphax.timesheet.data.model.Category
import com.graphax.timesheet.data.model.TimeEntry

@Database(entities = [Category::class, TimeEntry::class], version = 1, exportSchema = false)
abstract class TimesheetDatabase : RoomDatabase() {
    abstract fun categoryDao(): CategoryDao
    abstract fun timeEntryDao(): TimeEntryDao

    companion object {
        @Volatile private var INSTANCE: TimesheetDatabase? = null

        fun getInstance(context: Context): TimesheetDatabase =
            INSTANCE ?: synchronized(this) {
                Room.databaseBuilder(context.applicationContext, TimesheetDatabase::class.java, "timesheet.db")
                    .build()
                    .also { INSTANCE = it }
            }
    }
}
