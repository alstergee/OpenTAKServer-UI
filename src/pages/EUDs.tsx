import { ActionIcon, Modal, Group, Button, Text, Table } from '@mantine/core';
import React, { useEffect, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconTrash, IconX } from '@tabler/icons-react';
import axios from '../axios_config';
import { apiRoutes } from '../apiRoutes';
import { Link } from "react-router";
import { t } from "i18next";
import { DataTable, type DataTableSortStatus } from 'mantine-datatable';

export interface EUD {
    callsign: React.ReactNode;
    device: string;
    platform: string;
    os: string;
    phone_number: number;
    username: string;
    uid: string;
    version: string;
    last_event_time: string;
    last_status: string;
    actions?: React.ReactNode;
}

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
    const [confirmDelete, setConfirmDelete] = useState<{ uid: string; callsign: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

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

    function getEuds() {
        if (loading) {
            return;
        }
        setLoading(true);

        axios.get(apiRoutes.eud, { params: { page: activePage, per_page: pageSize, sort_by: sortStatus.columnAccessor, sort_direction: sortStatus.direction} }).then(r => {
            setLoading(false);
            if (r.status === 200) {
                setEUDCount(r.data.total)
                let rows: EUD[] = []

                r.data.results.map((row:any) => {
                    const callsign_link = <Link to={`/eud_stats?uid=${row.uid}&callsign=${row.callsign}`}>{row.callsign}</Link>
                    const actions = (
                        <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={() => setConfirmDelete({ uid: row.uid, callsign: row.callsign })}
                            title={t('Delete EUD') as string}
                        >
                            <IconTrash size={16} />
                        </ActionIcon>
                    );
                    let eud: EUD = {
                        callsign: callsign_link,
                        device: row.device,
                        platform: row.platform,
                        os: row.os,
                        phone_number: row.phone_number,
                        username: row.username,
                        uid: row.uid,
                        version: row.version,
                        last_event_time: row.last_event_time,
                        last_status: row.last_status,
                        actions,
                    }
                    rows.push(eud);
                });

                setPage(r.data.current_page);
                setTotalPages(r.data.total_pages);
                setEuds(rows);
            }
        }).catch(err => {
            setLoading(false);
            notifications.show({
                title: t('Failed to get EUDs'),
                message: err.response?.data?.error || err.message,
                icon: <IconX />,
                color: 'red',
            })
        });
    }

    useEffect(() => {
        setPage(1);
        getEuds();
    }, [pageSize]);

    useEffect(() => {
        getEuds();
    }, [activePage, sortStatus]);

    return (
        <>
            <Table.ScrollContainer minWidth="100%">
                <DataTable
                    withTableBorder
                    borderRadius="md"
                    shadow="sm"
                    striped
                    highlightOnHover
                    records={euds}
                    columns={[
                        {accessor: "callsign", title: t("Callsign"), sortable: true},
                        {accessor: "device", title: t("Device"), sortable: true},
                        {accessor: "platform", title: t("Platform"), sortable: true},
                        {accessor: "os", title: t("OS"), sortable: true},
                        {accessor: "phone_number", title: t("Phone Number"), sortable: true},
                        {accessor: "username", title: t("Username")},
                        {accessor: "uid", title: t("UID")},
                        {accessor: "version", title: t("Version"), sortable: true},
                        {accessor: "last_event_time", title: t("Last Event Time"), sortable: true},
                        {accessor: "last_status", title: t("Last Event"), sortable: true},
                        {accessor: "actions", title: "", width: 50, textAlign: "center"},
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
            </Table.ScrollContainer>

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
        </>
    );
}
