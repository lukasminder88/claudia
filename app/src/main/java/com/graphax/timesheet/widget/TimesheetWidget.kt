package com.graphax.timesheet.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.graphax.timesheet.R
import com.graphax.timesheet.data.db.TimesheetDatabase
import com.graphax.timesheet.data.repository.TimesheetRepository
import com.graphax.timesheet.service.TimerService
import com.graphax.timesheet.utils.FormatUtils
import kotlinx.coroutines.*

class TimesheetWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { updateWidget(context, manager, it) }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == AppWidgetManager.ACTION_APPWIDGET_UPDATE) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, TimesheetWidget::class.java))
            ids.forEach { updateWidget(context, manager, it) }
        }
    }

    companion object {
        fun updateAll(context: Context) {
            val intent = Intent(context, TimesheetWidget::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            }
            context.sendBroadcast(intent)
        }

        fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            CoroutineScope(Dispatchers.IO).launch {
                val db = TimesheetDatabase.getInstance(context)
                val repo = TimesheetRepository(db.categoryDao(), db.timeEntryDao())
                val active = repo.getActiveEntryRaw()

                val views = RemoteViews(context.packageName, R.layout.widget_timesheet)

                if (active != null) {
                    val elapsed = System.currentTimeMillis() - active.entry.startTime
                    views.setTextViewText(R.id.tv_widget_status, active.category.name)
                    views.setTextViewText(R.id.tv_widget_elapsed, FormatUtils.formatDuration(elapsed))

                    val stopIntent = Intent(context, TimerService::class.java).apply {
                        action = TimerService.ACTION_STOP
                    }
                    val stopPi = PendingIntent.getService(context, 0, stopIntent, PendingIntent.FLAG_IMMUTABLE)
                    views.setOnClickPendingIntent(R.id.btn_widget_stop, stopPi)
                    views.setViewVisibility(R.id.btn_widget_stop, android.view.View.VISIBLE)
                    views.setViewVisibility(R.id.tv_widget_elapsed, android.view.View.VISIBLE)
                } else {
                    views.setTextViewText(R.id.tv_widget_status, "No active timer")
                    views.setTextViewText(R.id.tv_widget_elapsed, "")
                    views.setViewVisibility(R.id.btn_widget_stop, android.view.View.GONE)
                    views.setViewVisibility(R.id.tv_widget_elapsed, android.view.View.GONE)
                }

                withContext(Dispatchers.Main) {
                    manager.updateAppWidget(widgetId, views)
                }
            }
        }
    }
}
