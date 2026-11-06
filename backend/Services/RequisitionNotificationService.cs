using System.Collections.Concurrent;

namespace StoreManager.Api.Services;

public class RequisitionLiveEvent
{
    public long EventId { get; set; }
    public string EventType { get; set; } = "REQUISITION_RAISED"; // REQUISITION_RAISED, REQUISITION_ALLOWED, REQUISITION_DENIED, REQUISITION_UPDATED
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public int RequisitionId { get; set; }
    public string RequisitionNumber { get; set; } = string.Empty;
    public int? DepartmentId { get; set; }
    public string? DepartmentName { get; set; }
    public string? RequestedBy { get; set; }
    public decimal TotalEstimatedCost { get; set; }
    public string Status { get; set; } = "Pending";
    public int ItemsCount { get; set; }
    public string? ResultingIssueSlipNumber { get; set; }
    public string? DenialRemarks { get; set; }
    public string Message { get; set; } = string.Empty;
}

public interface IRequisitionNotificationService
{
    void PublishEvent(RequisitionLiveEvent liveEvent);
    List<RequisitionLiveEvent> GetEventsSince(long sinceEventId, int? departmentId = null);
    long GetLatestEventId();
}

public class RequisitionNotificationService : IRequisitionNotificationService
{
    private static long _counter = 0;
    private readonly ConcurrentQueue<RequisitionLiveEvent> _events = new();
    private const int MaxEvents = 100;
    private readonly ILogger<RequisitionNotificationService> _logger;

    public RequisitionNotificationService(ILogger<RequisitionNotificationService> logger)
    {
        _logger = logger;
    }

    public void PublishEvent(RequisitionLiveEvent liveEvent)
    {
        liveEvent.EventId = Interlocked.Increment(ref _counter);
        liveEvent.Timestamp = DateTime.UtcNow;

        _events.Enqueue(liveEvent);

        // Keep buffer bounded
        while (_events.Count > MaxEvents && _events.TryDequeue(out _)) { }

        _logger.LogInformation("[REALTIME EVENT #{EventId}] {EventType} for {RequisitionNumber} ({DepartmentName}): {Message}",
            liveEvent.EventId, liveEvent.EventType, liveEvent.RequisitionNumber, liveEvent.DepartmentName, liveEvent.Message);
    }

    public List<RequisitionLiveEvent> GetEventsSince(long sinceEventId, int? departmentId = null)
    {
        var allEvents = _events.ToArray();
        return allEvents
            .Where(e => e.EventId > sinceEventId && (!departmentId.HasValue || departmentId.Value == 0 || e.DepartmentId == departmentId.Value))
            .OrderBy(e => e.EventId)
            .ToList();
    }

    public long GetLatestEventId()
    {
        return Interlocked.Read(ref _counter);
    }
}
