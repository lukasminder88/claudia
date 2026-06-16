package com.graphax.timesheet.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.graphax.timesheet.service.TimerService

class WidgetActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            "com.graphax.timesheet.WIDGET_ACTION" -> {
                val categoryId = intent.getLongExtra("category_id", -1L)
                if (categoryId != -1L) {
                    TimerService.start(context, categoryId)
                } else {
                    TimerService.stop(context)
                }
            }
        }
    }
}
