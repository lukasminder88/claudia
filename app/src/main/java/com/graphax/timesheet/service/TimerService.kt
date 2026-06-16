package com.graphax.timesheet.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.graphax.timesheet.R
import com.graphax.timesheet.data.db.TimesheetDatabase
import com.graphax.timesheet.data.repository.TimesheetRepository
import com.graphax.timesheet.ui.MainActivity
import com.graphax.timesheet.widget.TimesheetWidget
import kotlinx.coroutines.*
import java.util.concurrent.TimeUnit

class TimerService : Service() {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var tickJob: Job? = null
    private lateinit var repository: TimesheetRepository

    override fun onCreate() {
        super.onCreate()
        val db = TimesheetDatabase.getInstance(this)
        repository = TimesheetRepository(db.categoryDao(), db.timeEntryDao())
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val categoryId = intent.getLongExtra(EXTRA_CATEGORY_ID, -1)
                if (categoryId != -1L) startTracking(categoryId)
            }
            ACTION_STOP -> stopTracking()
        }
        return START_NOT_STICKY
    }

    private fun startTracking(categoryId: Long) {
        scope.launch {
            repository.stopTimer()
            repository.startTimer(categoryId)
            withContext(Dispatchers.Main) {
                startForeground(NOTIFICATION_ID, buildNotification("Starting...", "00:00:00"))
                startTicking()
                TimesheetWidget.updateAll(this@TimerService)
            }
        }
    }

    private fun stopTracking() {
        scope.launch {
            repository.stopTimer()
            withContext(Dispatchers.Main) {
                stopTicking()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                TimesheetWidget.updateAll(this@TimerService)
            }
        }
    }

    private fun startTicking() {
        tickJob = scope.launch(Dispatchers.Main) {
            while (true) {
                delay(1000)
                val active = withContext(Dispatchers.IO) { repository.getActiveEntryRaw() }
                if (active != null) {
                    val elapsed = System.currentTimeMillis() - active.entry.startTime
                    val h = TimeUnit.MILLISECONDS.toHours(elapsed)
                    val m = TimeUnit.MILLISECONDS.toMinutes(elapsed) % 60
                    val s = TimeUnit.MILLISECONDS.toSeconds(elapsed) % 60
                    val time = "%02d:%02d:%02d".format(h, m, s)
                    updateNotification(active.category.name, time)
                } else {
                    stopSelf()
                    break
                }
            }
        }
    }

    private fun stopTicking() {
        tickJob?.cancel()
        tickJob = null
    }

    private fun updateNotification(categoryName: String, elapsed: String) {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, buildNotification(categoryName, elapsed))
    }

    private fun buildNotification(categoryName: String, elapsed: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pi = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)
        val stopIntent = Intent(this, TimerService::class.java).apply { action = ACTION_STOP }
        val stopPi = PendingIntent.getService(this, 1, stopIntent, PendingIntent.FLAG_IMMUTABLE)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(categoryName)
            .setContentText(elapsed)
            .setSmallIcon(R.drawable.ic_timer)
            .setContentIntent(pi)
            .addAction(R.drawable.ic_stop, "Stop", stopPi)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(CHANNEL_ID, "Timer", NotificationManager.IMPORTANCE_LOW)
        channel.description = "Active time tracking"
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        const val ACTION_START = "com.graphax.timesheet.START"
        const val ACTION_STOP = "com.graphax.timesheet.STOP"
        const val EXTRA_CATEGORY_ID = "category_id"
        const val NOTIFICATION_ID = 1
        const val CHANNEL_ID = "timer_channel"

        fun start(context: Context, categoryId: Long) {
            val intent = Intent(context, TimerService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_CATEGORY_ID, categoryId)
            }
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, TimerService::class.java).apply { action = ACTION_STOP }
            context.startService(intent)
        }
    }
}
