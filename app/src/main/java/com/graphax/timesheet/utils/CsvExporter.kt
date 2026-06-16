package com.graphax.timesheet.utils

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.graphax.timesheet.data.model.TimeEntryWithCategory
import java.io.File
import java.io.OutputStreamWriter
import java.text.SimpleDateFormat
import java.util.*

object CsvExporter {
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
    private val fileDateFormat = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault())

    fun export(context: Context, entries: List<TimeEntryWithCategory>): String {
        val filename = "timesheet_${fileDateFormat.format(Date())}.csv"
        val csvContent = buildCsv(entries)

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveViaMediaStore(context, filename, csvContent)
        } else {
            saveToLegacyStorage(filename, csvContent)
        }
    }

    private fun buildCsv(entries: List<TimeEntryWithCategory>): String {
        val sb = StringBuilder()
        sb.appendLine("Category,Color,Start,End,Duration (min),Note")
        entries.forEach { e ->
            val start = dateFormat.format(Date(e.entry.startTime))
            val end = e.entry.endTime?.let { dateFormat.format(Date(it)) } ?: "running"
            val durationMin = if (e.entry.endTime != null) {
                ((e.entry.endTime - e.entry.startTime) / 60000)
            } else 0L
            sb.appendLine("\"${e.category.name}\",\"${e.category.colorHex}\",\"$start\",\"$end\",$durationMin,\"${e.entry.note}\"")
        }
        return sb.toString()
    }

    private fun saveViaMediaStore(context: Context, filename: String, content: String): String {
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, filename)
            put(MediaStore.Downloads.MIME_TYPE, "text/csv")
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        }
        val uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: throw IllegalStateException("Could not create file")
        context.contentResolver.openOutputStream(uri)?.use { stream ->
            OutputStreamWriter(stream).use { it.write(content) }
        }
        return "Downloads/$filename"
    }

    @Suppress("DEPRECATION")
    private fun saveToLegacyStorage(filename: String, content: String): String {
        val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        val file = File(dir, filename)
        file.writeText(content)
        return file.absolutePath
    }
}
