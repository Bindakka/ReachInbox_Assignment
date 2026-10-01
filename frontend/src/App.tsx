import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:5000";

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

interface Email {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);

  const [emails, setEmails] = useState<Email[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);

  const [loading, setLoading] = useState(true);

  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [startTime, setStartTime] = useState("");
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(100);

  const [uploadedEmails, setUploadedEmails] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");

  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  // ==========================================
  // LOAD DASHBOARD
  // ==========================================

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const userResponse = await axios.get(
          `${API}/auth/me`,
          {
            withCredentials: true,
          }
        );

        setUser(userResponse.data.user);

        const scheduledResponse =
          await axios.get(
            `${API}/api/emails/scheduled`,
            {
              withCredentials: true,
            }
          );

        setEmails(
          scheduledResponse.data.emails
        );

        const sentResponse =
          await axios.get(
            `${API}/api/emails/sent`,
            {
              withCredentials: true,
            }
          );

        setSentEmails(
          sentResponse.data.emails
        );
      } catch (error) {
        console.error(
          "Dashboard loading error:",
          error
        );

        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  // ==========================================
  // LOGIN
  // ==========================================

  const login = () => {
    window.location.href =
      `${API}/auth/google`;
  };

  // ==========================================
  // LOGOUT
  // ==========================================

  const logout = async () => {
    try {
      await axios.post(
        `${API}/auth/logout`,
        {},
        {
          withCredentials: true,
        }
      );

      setUser(null);
      setEmails([]);
      setSentEmails([]);
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );
    }
  };

  // ==========================================
  // LOAD SCHEDULED EMAILS
  // ==========================================

  const loadScheduledEmails =
    async () => {
      try {
        const response =
          await axios.get(
            `${API}/api/emails/scheduled`,
            {
              withCredentials: true,
            }
          );

        setEmails(
          response.data.emails
        );
      } catch (error) {
        console.error(
          "Failed to load scheduled emails:",
          error
        );
      }
    };

  // ==========================================
  // LOAD SENT EMAILS
  // ==========================================

  const loadSentEmails =
    async () => {
      try {
        const response =
          await axios.get(
            `${API}/api/emails/sent`,
            {
              withCredentials: true,
            }
          );

        setSentEmails(
          response.data.emails
        );
      } catch (error) {
        console.error(
          "Failed to load sent emails:",
          error
        );
      }
    };

  // ==========================================
  // CSV / TXT FILE UPLOAD
  // ==========================================

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setFileName(file.name);
    setMessage("");

    const reader =
      new FileReader();

    reader.onload = (e) => {
      const text = String(
        e.target?.result || ""
      );

      const matches =
        text.match(
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
        ) || [];

      const uniqueEmails = [
        ...new Set(
          matches.map(
            (email) =>
              email.trim().toLowerCase()
          )
        ),
      ];

      setUploadedEmails(
        uniqueEmails
      );

      if (
        uniqueEmails.length === 0
      ) {
        setMessage(
          "No email addresses found in the uploaded file."
        );
      } else {
        setMessage(
          `${uniqueEmails.length} email(s) detected successfully.`
        );
      }
    };

    reader.readAsText(file);
  };

  // ==========================================
  // REMOVE UPLOADED EMAIL
  // ==========================================

  const removeUploadedEmail = (
    emailToRemove: string
  ) => {
    setUploadedEmails(
      (previous) =>
        previous.filter(
          (email) =>
            email !== emailToRemove
        )
    );
  };

  // ==========================================
  // CLEAR UPLOAD
  // ==========================================

  const clearUpload = () => {
    setUploadedEmails([]);
    setFileName("");
    setMessage("");
  };

  // ==========================================
  // SCHEDULE EMAILS
  // ==========================================

  const scheduleEmail = async () => {
    if (
      (!recipient &&
        uploadedEmails.length === 0) ||
      !subject ||
      !body ||
      !startTime
    ) {
      setMessage(
        "Please provide recipient(s), subject, message and start time."
      );

      return;
    }

    if (
      uploadedEmails.length === 0 &&
      !recipient
    ) {
      setMessage(
        "Please enter a recipient or upload a CSV/TXT file."
      );

      return;
    }

    try {
      setSending(true);
      setMessage("");

      const recipients =
        uploadedEmails.length > 0
          ? uploadedEmails.map(
              (email) => ({
                recipient: email,
                subject,
                body,
              })
            )
          : [
              {
                recipient,
                subject,
                body,
              },
            ];

      const response =
        await axios.post(
          `${API}/api/emails/schedule`,
          {
            emails: recipients,

            startTime:
              new Date(
                startTime
              ).toISOString(),

            delayMs,

            hourlyLimit,
          },
          {
            withCredentials: true,
          }
        );

      setMessage(
        response.data.message
      );

      // Clear compose fields
      setRecipient("");
      setSubject("");
      setBody("");
      setStartTime("");

      // Clear uploaded file
      setUploadedEmails([]);
      setFileName("");

      // Reload database list
      const scheduledResponse =
        await axios.get(
          `${API}/api/emails/scheduled`,
          {
            withCredentials: true,
          }
        );

      setEmails(
        scheduledResponse.data.emails
      );

      // Reload sent emails
      await loadSentEmails();
    } catch (error: any) {
      console.error(
        "Schedule error:",
        error
      );

      setMessage(
        error.response?.data?.message ||
          "Failed to schedule email."
      );
    } finally {
      setSending(false);
    }
  };

  // ==========================================
  // LOADING SCREEN
  // ==========================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl">
          Loading...
        </p>
      </div>
    );
  }

  // ==========================================
  // LOGIN SCREEN
  // ==========================================

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">

        <div className="bg-white p-10 rounded-2xl shadow-lg text-center w-[420px]">

          <h1 className="text-4xl font-bold mb-3">
            ReachInbox
          </h1>

          <p className="text-gray-500 mb-8">
            Email Scheduling &
            Automation Platform
          </p>

          <button
            onClick={login}
            className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800"
          >
            Continue with Google
          </button>

        </div>

      </div>
    );
  }

  // ==========================================
  // COUNTS
  // ==========================================

  const scheduledCount =
    emails.length;

  const sentCount =
    sentEmails.length;

  // ==========================================
  // DASHBOARD
  // ==========================================

  return (
    <div className="min-h-screen bg-gray-100">

      {/* ================= HEADER ================= */}

      <header className="bg-white border-b px-8 py-4 flex justify-between items-center">

        <div>
          <h1 className="text-2xl font-bold">
            ReachInbox
          </h1>

          <p className="text-sm text-gray-500">
            Email Scheduling Dashboard
          </p>
        </div>

        <div className="flex items-center gap-4">

          {user.avatar && (
            <img
              src={user.avatar}
              alt="Profile"
              className="w-10 h-10 rounded-full"
            />
          )}

          <div>
            <p className="font-medium">
              {user.name}
            </p>

            <p className="text-xs text-gray-500">
              {user.email}
            </p>
          </div>

          <button
            onClick={logout}
            className="border px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Logout
          </button>

        </div>

      </header>

      <main className="max-w-7xl mx-auto p-8">

        {/* ================= STATS ================= */}

        <div className="grid grid-cols-3 gap-6 mb-8">

          <div className="bg-white p-6 rounded-xl shadow-sm">

            <p className="text-gray-500">
              Scheduled Emails
            </p>

            <p className="text-3xl font-bold mt-2">
              {scheduledCount}
            </p>

          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm">

            <p className="text-gray-500">
              Sent Emails
            </p>

            <p className="text-3xl font-bold mt-2">
              {sentCount}
            </p>

          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm">

            <p className="text-gray-500">
              Worker Concurrency
            </p>

            <p className="text-3xl font-bold mt-2">
              5
            </p>

          </div>

        </div>

        {/* ================= COMPOSE ================= */}

        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">

          <h2 className="text-xl font-semibold mb-6">
            Compose New Email
          </h2>

          {/* ================= FILE UPLOAD ================= */}

          <div className="mb-8 border-2 border-dashed border-gray-300 rounded-xl p-6">

            <h3 className="font-semibold text-lg mb-2">
              Upload CSV / TXT File
            </h3>

            <p className="text-sm text-gray-500 mb-4">
              Upload a CSV or TXT file
              containing email addresses.
            </p>

            <input
              type="file"
              accept=".csv,.txt"
              onChange={
                handleFileUpload
              }
              className="block w-full border rounded-lg p-3"
            />

            {fileName && (
              <div className="mt-4 flex items-center justify-between bg-gray-50 p-3 rounded-lg">

                <p className="text-sm">
                  File:
                  <strong className="ml-1">
                    {fileName}
                  </strong>
                </p>

                <button
                  onClick={clearUpload}
                  className="text-sm border px-3 py-1 rounded-lg hover:bg-gray-100"
                >
                  Clear
                </button>

              </div>
            )}

            {uploadedEmails.length >
              0 && (
              <div className="mt-4 bg-gray-100 rounded-lg p-4">

                <div className="flex justify-between items-center">

                  <p className="font-semibold">
                    {
                      uploadedEmails.length
                    }{" "}
                    email(s) detected
                  </p>

                  <span className="text-sm text-gray-500">
                    Ready to schedule
                  </span>

                </div>

                <div className="mt-3 max-h-40 overflow-y-auto">

                  {uploadedEmails.map(
                    (email) => (
                      <div
                        key={email}
                        className="flex justify-between items-center py-1 text-sm"
                      >

                        <span>
                          {email}
                        </span>

                        <button
                          onClick={() =>
                            removeUploadedEmail(
                              email
                            )
                          }
                          className="text-red-500 ml-4"
                        >
                          Remove
                        </button>

                      </div>
                    )
                  )}

                </div>

              </div>
            )}

          </div>

          {/* ================= MANUAL RECIPIENT ================= */}

          <div className="grid grid-cols-2 gap-6">

            <div>

              <label className="block text-sm font-medium mb-2">
                Recipient
              </label>

              <input
                type="email"
                value={recipient}
                onChange={(e) =>
                  setRecipient(
                    e.target.value
                  )
                }
                placeholder="recipient@example.com"
                className="w-full border rounded-lg px-4 py-3"
              />

              <p className="text-xs text-gray-400 mt-1">
                Leave empty when using
                CSV/TXT upload.
              </p>

            </div>

            <div>

              <label className="block text-sm font-medium mb-2">
                Subject
              </label>

              <input
                type="text"
                value={subject}
                onChange={(e) =>
                  setSubject(
                    e.target.value
                  )
                }
                placeholder="Email subject"
                className="w-full border rounded-lg px-4 py-3"
              />

            </div>

          </div>

          {/* ================= MESSAGE ================= */}

          <div className="mt-5">

            <label className="block text-sm font-medium mb-2">
              Message
            </label>

            <textarea
              value={body}
              onChange={(e) =>
                setBody(
                  e.target.value
                )
              }
              placeholder="Write your email..."
              rows={5}
              className="w-full border rounded-lg px-4 py-3"
            />

          </div>

          {/* ================= SETTINGS ================= */}

          <div className="grid grid-cols-3 gap-6 mt-5">

            <div>

              <label className="block text-sm font-medium mb-2">
                Start Time
              </label>

              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) =>
                  setStartTime(
                    e.target.value
                  )
                }
                className="w-full border rounded-lg px-4 py-3"
              />

            </div>

            <div>

              <label className="block text-sm font-medium mb-2">
                Delay Between Emails (ms)
              </label>

              <input
                type="number"
                value={delayMs}
                min={0}
                onChange={(e) =>
                  setDelayMs(
                    Number(
                      e.target.value
                    )
                  )
                }
                className="w-full border rounded-lg px-4 py-3"
              />

            </div>

            <div>

              <label className="block text-sm font-medium mb-2">
                Hourly Limit
              </label>

              <input
                type="number"
                value={hourlyLimit}
                min={1}
                onChange={(e) =>
                  setHourlyLimit(
                    Number(
                      e.target.value
                    )
                  )
                }
                className="w-full border rounded-lg px-4 py-3"
              />

            </div>

          </div>

          {/* ================= MESSAGE ================= */}

          {message && (
            <div className="mt-5 bg-gray-100 rounded-lg p-3">
              {message}
            </div>
          )}

          {/* ================= SCHEDULE BUTTON ================= */}

          <button
            onClick={scheduleEmail}
            disabled={sending}
            className="mt-6 bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {sending
              ? "Scheduling..."
              : uploadedEmails.length >
                0
              ? `Schedule ${uploadedEmails.length} Emails`
              : "Schedule Email"}
          </button>

        </div>

        {/* ================= SCHEDULED EMAILS ================= */}

        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">

          <div className="flex justify-between items-center mb-5">

            <h2 className="text-xl font-semibold">
              Scheduled Emails
            </h2>

            <button
              onClick={
                loadScheduledEmails
              }
              className="border px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Refresh
            </button>

          </div>

          {emails.length === 0 ? (

            <div className="border rounded-lg p-10 text-center text-gray-500">
              No scheduled emails yet.
            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead>

                  <tr className="border-b text-left">

                    <th className="p-3">
                      Recipient
                    </th>

                    <th className="p-3">
                      Subject
                    </th>

                    <th className="p-3">
                      Scheduled At
                    </th>

                    <th className="p-3">
                      Status
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {emails.map(
                    (email) => (

                      <tr
                        key={email.id}
                        className="border-b"
                      >

                        <td className="p-3">
                          {email.recipient}
                        </td>

                        <td className="p-3">
                          {email.subject}
                        </td>

                        <td className="p-3">
                          {new Date(
                            email.scheduledAt
                          ).toLocaleString()}
                        </td>

                        <td className="p-3">

                          <span className="px-3 py-1 rounded-full bg-gray-100">
                            {email.status}
                          </span>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </div>

        {/* ================= SENT EMAILS ================= */}

        <div className="bg-white rounded-xl shadow-sm p-6">

          <div className="flex justify-between items-center mb-5">

            <h2 className="text-xl font-semibold">
              Sent Emails
            </h2>

            <button
              onClick={loadSentEmails}
              className="border px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Refresh
            </button>

          </div>

          {sentEmails.length === 0 ? (

            <div className="border rounded-lg p-10 text-center text-gray-500">
              No sent emails yet.
            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead>

                  <tr className="border-b text-left">

                    <th className="p-3">
                      Recipient
                    </th>

                    <th className="p-3">
                      Subject
                    </th>

                    <th className="p-3">
                      Sent At
                    </th>

                    <th className="p-3">
                      Status
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {sentEmails.map(
                    (email) => (

                      <tr
                        key={email.id}
                        className="border-b"
                      >

                        <td className="p-3">
                          {email.recipient}
                        </td>

                        <td className="p-3">
                          {email.subject}
                        </td>

                        <td className="p-3">

                          {email.sentAt
                            ? new Date(
                                email.sentAt
                              ).toLocaleString()
                            : "-"}

                        </td>

                        <td className="p-3">

                          <span className="px-3 py-1 rounded-full bg-gray-100">
                            {email.status}
                          </span>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </main>

    </div>
  );
}

export default App;