import {
    ActionIcon,
    Modal,
    Group,
    Button,
    Text,
    Stack,
    TextInput,
    Tooltip,
    Box,
    Paper,
    Title,
} from '@mantine/core';
import React, { useEffect, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import {
    IconCheck,
    IconEdit,
    IconTrash,
    IconX,
} from '@tabler/icons-react';
import axios from '../axios_config';
import { apiRoutes } from '../apiRoutes';
import { Link } from "react-router";
import { t } from "i18next";
import { DataTable, type DataTableSortStatus } from 'mantine-datatable';

export interface EUD {
    callsign: string;
    device: string;
    platform: string;
    os: string;
    phone_number: number | null;
    username: string;
    uid: string;
    version: string;
    team_role?: string;
    last_event_time: string;
    last_status: string;
}

interface EditFormValues {
    callsign: string;
    device: string;
    platform: string;
    os: string;
    version: string;
    phone_number: string;
    team_role: string;
}

const EMPTY_EDIT_FORM: EditFormValues = {
    callsign: '',
    device: '',
    platform: '',
    os: '',
    version: '',
    phone_number: '',
    team_role: '',
};

export default function EUDs() {
    const [euds, setEuds] = useState<EUD[]>([]);
    const [eudCount, setEUDCount] = useState<number>(0);
    const [activePage, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [pageSize, setPageSize] = useState(10);
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus<EUD>>({
        columnAccessor: 'last_event_time',
        direction: 'desc',
    });
    const [selectedRecords, setSelectedRecords] = useState<EUD[]>([]);

    const [confirmDelete, setConfirmDelete] = useState<{ uid: string; callsign: string } | null>(null);
    const [bulkConfirm, setBulkConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [editTarget, setEditTarget] = useState<EUD | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const editForm = useForm<EditFormValues>({
        initialValues: EMPTY_EDIT_FORM,
        validate: {
            phone_number: (value) =>
                value && !/^\+?\d[\d\s\-()]{0,20}$/.test(value)
                    ? (t('Phone number must be digits (optional + and separators)') as string)
                    : null,
            callsign: (value) =>
                value && value.length > 255
                    ? (t('Callsign too long') as string)
                    : null,
        },
    });

    function openEdit(eud: EUD) {
        editForm.setValues({
            callsign: eud.callsign ?? '',
            device: eud.device ?? '',
            platform: eud.platform ?? '',
            os: eud.os ?? '',
            version: eud.version ?? '',
            phone_number: eud.phone_number != null ? String(eud.phone_number) : '',
            team_role: eud.team_role ?? '',
        });
        editForm.resetDirty();
        setEditTarget(eud);
    }

    function submitEdit(values: EditFormValues) {
        if (!editTarget) return;
        setSubmitting(true);
        // Strip phone-number formatting before sending; the server casts to BigInteger.
        const payload: Record<string, string | null> = {
            callsign: values.callsign.trim() || null,
            device: values.device.trim() || null,
            platform: values.platform.trim() || null,
            os: values.os.trim() || null,
            version: values.version.trim() || null,
            phone_number: values.phone_number.trim()
                ? values.phone_number.replace(/[^\d]/g, '')
                : null,
            team_role: values.team_role.trim() || null,
        };
        axios.patch(`${apiRoutes.eud}/${encodeURIComponent(editTarget.uid)}`, payload)
            .then(r => {
                setSubmitting(false);
                if (r.status === 200 && r.data?.success) {
                    notifications.show({
                        title: t('EUD updated'),
                        message: r.data.callsign ?? editTarget.uid,
                        icon: <IconCheck />, color: 'green',
                    });
                    setEditTarget(null);
                    getEuds();
                } else {
                    notifications.show({
                        title: t('Failed to update EUD'),
                        message: r.data?.error || 'unknown',
                        icon: <IconX />, color: 'red',
                    });
                }
            })
            .catch(err => {
                setSubmitting(false);
                notifications.show({
                    title: t('Failed to update EUD'),
                    message: err.response?.data?.error || err.message,
                    icon: <IconX />, color: 'red',
                });
            });
    }

    function deleteEud(uid: string, callsign: string) {
        setDeleting(true);
        axios.delete(`${apiRoutes.eud}/${encodeURIComponent(uid)}`).then(r => {
            setDeleting(false);
            setConfirmDelete(null);
            if (r.status === 200 && r.data?.success) {
                notifications.show({
                    title: t('EUD deleted'),
                    message: callsign,
                    icon: <IconCheck />, color: 'green',
                });
                getEuds();
            } else {
                notifications.show({
                    title: t('Failed to delete EUD'),
                    message: r.data?.error || 'unknown',
                    icon: <IconX />, color: 'red',
                });
            }
        }).catch(err => {
            setDeleting(false);
            setConfirmDelete(null);
            notifications.show({
                title: t('Failed to delete EUD'),
                message: err.response?.data?.error || err.message,
                icon: <IconX />, color: 'red',
            });
        });
    }

    async function bulkDelete() {
        setDeleting(true);
        const targets = [...selectedRecords];
        const failures: { uid: string; error: string }[] = [];
        let succeeded = 0;
        for (const eud of targets) {
            try {
                const r = await axios.delete(`${apiRoutes.eud}/${encodeURIComponent(eud.uid)}`);
                if (r.status === 200 && r.data?.success) {
                    succeeded += 1;
                } else {
                    failures.push({ uid: eud.uid, error: r.data?.error || 'unknown' });
                }
            } catch (err: any) {
                failures.push({ uid: eud.uid, error: err.response?.data?.error || err.message });
            }
        }
        setDeleting(false);
        setBulkConfirm(false);
        setSelectedRecords([]);
        if (succeeded > 0) {
            notifications.show({
                title: t('EUDs deleted'),
                message: t('{{count}} of {{total}} succeeded', { count: succeeded, total: targets.length }) as string,
                icon: <IconCheck />,
                color: failures.length ? 'yellow' : 'green',
            });
        }
        if (failures.length > 0) {
            notifications.show({
                title: t('Some deletes failed'),
                message: failures.map(f => `${f.uid}: ${f.error}`).join('\n').slice(0, 500),
                icon: <IconX />, color: 'red',
            });
        }
        getEuds();
    }

    function getEuds() {
        if (loading) {
            return;
        }
        setLoading(true);

        axios.get(apiRoutes.eud, { params: { page: activePage, per_page: pageSize, sort_by: sortStatus.columnAccessor, sort_direction: sortStatus.direction} }).then(r => {
            setLoading(false);
            if (r.status === 200) {
                setEUDCount(r.data.total);
                const rows: EUD[] = r.data.results.map((row: any) => ({
                    callsign: row.callsign,
                    device: row.device,
                    platform: row.platform,
                    os: row.os,
                    phone_number: row.phone_number,
                    username: row.username,
                    uid: row.uid,
                    version: row.version,
                    team_role: row.team_role,
                    last_event_time: row.last_event_time,
                    last_status: row.last_status,
                }));

                setPage(r.data.current_page);
                setTotalPages(r.data.total_pages);
                setEuds(rows);
                // Drop selections that are no longer in the visible page.
                setSelectedRecords(prev => prev.filter(s => rows.some(r => r.uid === s.uid)));
            }
        }).catch(err => {
            setLoading(false);
            notifications.show({
                title: t('Failed to get EUDs'),
                message: err.response?.data?.error || err.message,
                icon: <IconX />,
                color: 'red',
            });
        });
    }

    useEffect(() => {
        setPage(1);
        getEuds();
    }, [pageSize]);

    useEffect(() => {
        getEuds();
    }, [activePage, sortStatus]);

    const renderActions = (record: EUD) => (
        <Group gap={4} wrap="nowrap" justify="flex-start">
            <Tooltip label={t('Edit EUD') as string} withArrow>
                <ActionIcon
                    variant="subtle"
                    color="blue"
                    size="sm"
                    onClick={() => openEdit(record)}
                    aria-label={t('Edit EUD') as string}
                >
                    <IconEdit size={16} />
                </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Delete EUD') as string} withArrow>
                <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => setConfirmDelete({ uid: record.uid, callsign: record.callsign })}
                    aria-label={t('Delete EUD') as string}
                >
                    <IconTrash size={16} />
                </ActionIcon>
            </Tooltip>
        </Group>
    );

    const renderCallsignLink = (record: EUD) => (
        <Link to={`/eud_stats?uid=${encodeURIComponent(record.uid)}&callsign=${encodeURIComponent(record.callsign ?? '')}`}>
            {record.callsign}
        </Link>
    );

    return (
        <>
            {selectedRecords.length > 0 && (
                <Paper withBorder p="xs" mb="sm" shadow="xs">
                    <Group justify="space-between" wrap="nowrap">
                        <Text size="sm">
                            {t('{{count}} EUDs selected', { count: selectedRecords.length }) as string}
                        </Text>
                        <Group gap="xs">
                            <Button
                                variant="default"
                                size="xs"
                                onClick={() => setSelectedRecords([])}
                            >
                                {t('Clear')}
                            </Button>
                            <Button
                                color="red"
                                size="xs"
                                leftSection={<IconTrash size={14} />}
                                onClick={() => setBulkConfirm(true)}
                            >
                                {t('Delete selected')}
                            </Button>
                        </Group>
                    </Group>
                </Paper>
            )}

            <Box style={{ overflowX: 'auto' }}>
                <DataTable
                    withTableBorder
                    borderRadius="md"
                    shadow="sm"
                    striped
                    highlightOnHover
                    records={euds}
                    selectedRecords={selectedRecords}
                    onSelectedRecordsChange={setSelectedRecords}
                    idAccessor="uid"
                    columns={[
                        {
                            accessor: "actions",
                            title: "",
                            width: 80,
                            textAlign: "left",
                            render: renderActions,
                        },
                        {
                            accessor: "callsign",
                            title: t("Callsign"),
                            sortable: true,
                            render: renderCallsignLink,
                        },
                        {accessor: "device", title: t("Device"), sortable: true},
                        {accessor: "platform", title: t("Platform"), sortable: true},
                        {accessor: "os", title: t("OS"), sortable: true},
                        {accessor: "phone_number", title: t("Phone Number"), sortable: true},
                        {accessor: "username", title: t("Username")},
                        {accessor: "uid", title: t("UID")},
                        {accessor: "version", title: t("Version"), sortable: true},
                        {accessor: "last_event_time", title: t("Last Event Time"), sortable: true},
                        {accessor: "last_status", title: t("Last Event"), sortable: true},
                    ]}
                    page={activePage}
                    onPageChange={(p) => setPage(p)}
                    onRecordsPerPageChange={setPageSize}
                    totalRecords={eudCount}
                    recordsPerPage={pageSize}
                    recordsPerPageOptions={[10, 15, 20, 25, 30, 35, 40, 45, 50]}
                    sortStatus={sortStatus}
                    onSortStatusChange={setSortStatus}
                    fetching={loading}
                    minHeight={180}
                />
            </Box>

            <Modal
                opened={!!confirmDelete}
                onClose={() => !deleting && setConfirmDelete(null)}
                title={t('Delete EUD?')}
                centered
            >
                <Text size="sm" mb="md">
                    {t('Permanently delete')} <strong>{confirmDelete?.callsign}</strong> ({confirmDelete?.uid})?
                    {' '}
                    {t('This cascades through points, CoT, certificates, and chat history.')}
                </Text>
                <Group justify="flex-end">
                    <Button variant="default" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                        {t('Cancel')}
                    </Button>
                    <Button color="red" loading={deleting}
                        onClick={() => confirmDelete && deleteEud(confirmDelete.uid, confirmDelete.callsign)}>
                        {t('Delete')}
                    </Button>
                </Group>
            </Modal>

            <Modal
                opened={bulkConfirm}
                onClose={() => !deleting && setBulkConfirm(false)}
                title={t('Delete selected EUDs?')}
                centered
            >
                <Text size="sm" mb="md">
                    {t('Permanently delete {{count}} EUDs?', { count: selectedRecords.length }) as string}
                    {' '}
                    {t('This cascades through points, CoT, certificates, and chat history.')}
                </Text>
                <Group justify="flex-end">
                    <Button variant="default" onClick={() => setBulkConfirm(false)} disabled={deleting}>
                        {t('Cancel')}
                    </Button>
                    <Button color="red" loading={deleting} onClick={bulkDelete}>
                        {t('Delete {{count}} EUDs', { count: selectedRecords.length }) as string}
                    </Button>
                </Group>
            </Modal>

            <Modal
                opened={!!editTarget}
                onClose={() => !submitting && setEditTarget(null)}
                title={
                    editTarget
                        ? `${t('Edit EUD')} — ${editTarget.callsign ?? editTarget.uid}`
                        : t('Edit EUD')
                }
                centered
                size="lg"
            >
                {editTarget && (
                    <form onSubmit={editForm.onSubmit(submitEdit)}>
                        <Stack gap="sm">
                            <Paper withBorder p="xs" bg="var(--mantine-color-default-hover)">
                                <Stack gap={2}>
                                    <Title order={6}>{t('Identity (read-only)')}</Title>
                                    <Text size="xs" c="dimmed">
                                        {t('UID')}: <Text component="span" ff="monospace">{editTarget.uid}</Text>
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                        {t('Username')}: {editTarget.username || <em>{t('unassigned')}</em>}
                                    </Text>
                                </Stack>
                            </Paper>

                            <TextInput
                                label={t('Callsign')}
                                placeholder="Alpha-1"
                                {...editForm.getInputProps('callsign')}
                            />
                            <Group grow>
                                <TextInput
                                    label={t('Device')}
                                    placeholder="ATAK on Pixel 8"
                                    {...editForm.getInputProps('device')}
                                />
                                <TextInput
                                    label={t('Platform')}
                                    placeholder="ATAK"
                                    {...editForm.getInputProps('platform')}
                                />
                            </Group>
                            <Group grow>
                                <TextInput
                                    label={t('OS')}
                                    placeholder="Android 14"
                                    {...editForm.getInputProps('os')}
                                />
                                <TextInput
                                    label={t('Version')}
                                    placeholder="5.1.0"
                                    {...editForm.getInputProps('version')}
                                />
                            </Group>
                            <Group grow>
                                <TextInput
                                    label={t('Phone Number')}
                                    placeholder="+1 555 123 4567"
                                    {...editForm.getInputProps('phone_number')}
                                />
                                <TextInput
                                    label={t('Team Role')}
                                    placeholder="Team Lead"
                                    {...editForm.getInputProps('team_role')}
                                />
                            </Group>

                            <Group justify="flex-end" mt="xs">
                                <Button
                                    variant="default"
                                    onClick={() => setEditTarget(null)}
                                    disabled={submitting}
                                >
                                    {t('Cancel')}
                                </Button>
                                <Button
                                    type="submit"
                                    loading={submitting}
                                    disabled={!editForm.isDirty()}
                                >
                                    {t('Save changes')}
                                </Button>
                            </Group>
                        </Stack>
                    </form>
                )}
            </Modal>
        </>
    );
}
